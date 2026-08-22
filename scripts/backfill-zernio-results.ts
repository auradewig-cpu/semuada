// One-time correction of Threads / Facebook Page outcomes in
// scheduled_posts.provider_results.
//
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/backfill-zernio-results.ts
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/backfill-zernio-results.ts --apply
//
// Why this exists: postToZernio() used to send `scheduledAt`, a field name
// Zernio does not know, so from 2026-08-10 the daily build silently created
// DRAFTS -- accepted with HTTP 200, never published. Our side recorded ok:true
// for every one of them. Audited 2026-08-22: 196 drafts, 0 scheduled, across
// all 9 accounts. The dispatch bug is fixed and the sync now reconciles Zernio
// going forward, but ~100 historical rows still claim a success that never
// happened, and no code path will ever revisit them.
//
// This reads Zernio's own record and writes back what it says. It does not
// guess: a row it cannot match is left exactly as it is. Dry-run by default.
//
// Re-posting is NOT triggered by this: dispatch-posts only ever touches rows
// with status 'queued'. Flipping a result to ok:false only makes the row
// honest on the dashboard and eligible for the MANUAL per-post retry button.

import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { resolveDispatchOutcome } from "@root/lib/scheduler/dispatch";
import { ZERNIO_PLATFORMS } from "@root/lib/scheduler/platforms";
import type { ProviderResults, SchedulerPlatform } from "@root/lib/scheduler/types";

const APPLY = process.argv.includes("--apply");

// Zernio's platform vocabulary vs ours.
const FROM_ZERNIO: Record<string, SchedulerPlatform> = {
  threads: "threads",
  facebook: "facebook_page",
  facebook_page: "facebook_page",
};

// Legacy rows carry no postId at all. Zernio stamps a draft's `scheduledFor`
// at creation time, which is within seconds of our own posted_at (the moment
// the dispatch call returned). Measured over Akun 1's 17 legacy rows: 16
// matched inside 2 minutes, the 17th was an hour out (a leftover from manual
// testing) and is correctly skipped. 180s keeps that margin without reaching
// into a neighbouring account's slot, which is 11+ minutes away.
const MATCH_TOLERANCE_MS = 180_000;

const DEAD = new Set(["draft", "failed"]);
const PUBLISHED = new Set(["published"]);

type ZernioPost = { id: string; platform: SchedulerPlatform; status: string; at: number | null; error?: string };

async function fetchAllPosts(apiKey: string): Promise<ZernioPost[]> {
  const out: ZernioPost[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://zernio.com/api/v1/posts?limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`GET /posts halaman ${page} -> HTTP ${res.status}`);
    const json = await res.json();
    const posts: any[] = json?.posts ?? [];
    if (posts.length === 0) break;
    for (const p of posts) {
      const key = p?.platforms?.[0]?.platform;
      const platform = typeof key === "string" ? FROM_ZERNIO[key] : undefined;
      if (!platform || !p?._id) continue;
      const at = typeof p.scheduledFor === "string" ? new Date(p.scheduledFor).getTime() : null;
      out.push({
        id: p._id,
        platform,
        status: p.platforms[0].status && p.platforms[0].status !== "pending" ? p.platforms[0].status : String(p.status ?? ""),
        at: at !== null && !Number.isNaN(at) ? at : null,
        error: p.platforms[0].error ?? p.error ?? undefined,
      });
    }
    const totalPages = json?.pagination?.totalPages;
    if (typeof totalPages === "number" && page >= totalPages) break;
  }
  return out;
}

let totalFlipped = 0;
let totalIdFilled = 0;
let totalUnmatched = 0;
let totalStatusChanged = 0;

const accounts = await db.select().from(schedulerAccounts);

for (const account of accounts) {
  if (!account.zernioApiKey) {
    console.log(`\n${account.label}: tidak ada Zernio API key, dilewati.`);
    continue;
  }

  let zernioPosts: ZernioPost[];
  try {
    zernioPosts = await fetchAllPosts(account.zernioApiKey);
  } catch (err) {
    console.log(`\n${account.label}: GAGAL membaca Zernio -- ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }

  const byStatus: Record<string, number> = {};
  for (const p of zernioPosts) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  console.log(`\n${account.label}: ${zernioPosts.length} post di Zernio ${JSON.stringify(byStatus)}`);

  const rows = await db.select().from(scheduledPosts).where(eq(scheduledPosts.schedulerAccountId, account.id));
  // A Zernio post belongs to at most one of our rows.
  const consumed = new Set<string>();

  for (const row of rows) {
    const results = (row.providerResults as ProviderResults | null) ?? {};
    const next: ProviderResults = { ...results };
    let changed = false;

    for (const platform of (row.platforms as SchedulerPlatform[]).filter((p) => ZERNIO_PLATFORMS.includes(p))) {
      const entry = results[platform];
      if (!entry) continue;

      let match = entry.postId ? zernioPosts.find((p) => p.id === entry.postId) : undefined;

      if (!match && row.postedAt) {
        const anchor = row.postedAt.getTime();
        const candidates = zernioPosts
          .filter((p) => p.platform === platform && p.at !== null && !consumed.has(p.id))
          .map((p) => ({ p, d: Math.abs(p.at! - anchor) }))
          .filter((c) => c.d <= MATCH_TOLERANCE_MS)
          .sort((a, b) => a.d - b.d);
        match = candidates[0]?.p;
      }

      if (!match) {
        totalUnmatched++;
        continue;
      }
      consumed.add(match.id);

      if (DEAD.has(match.status) && entry.ok !== false) {
        next[platform] = {
          ok: false,
          postId: match.id,
          error: match.error ?? `Zernio menyimpan post ini sebagai "${match.status}" -- tidak pernah terbit.`,
        };
        changed = true;
        totalFlipped++;
      } else if (PUBLISHED.has(match.status) && !entry.postId) {
        // Genuinely published, we just never captured the id -- fill it in so
        // the metrics sync can match this post from now on.
        next[platform] = { ...entry, ok: true, postId: match.id };
        changed = true;
        totalIdFilled++;
      }
    }

    if (!changed) continue;

    const outcome = resolveDispatchOutcome(next);
    if (outcome.status !== row.status) totalStatusChanged++;

    if (APPLY) {
      await db
        .update(scheduledPosts)
        .set({ providerResults: next, status: outcome.status, errorMessage: outcome.errorMessage })
        .where(eq(scheduledPosts.id, row.id));
    }
    console.log(
      `  ${APPLY ? "TULIS" : "akan"} ${row.scheduledFor.toISOString().slice(0, 10)} ` +
        `${(row.platforms as string[]).filter((p) => ZERNIO_PLATFORMS.includes(p as SchedulerPlatform)).join("+")} ` +
        `-> ${row.status}=>${outcome.status}`
    );
  }
}

console.log(
  `\n${APPLY ? "DITERAPKAN" : "DRY-RUN"}: ${totalFlipped} hasil dibalik ke gagal, ${totalIdFilled} postId diisi, ` +
    `${totalStatusChanged} status baris berubah, ${totalUnmatched} platform-post tidak cocok (tidak disentuh).`
);
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menulis ke database.");
