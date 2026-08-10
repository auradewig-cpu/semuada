import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { postMetrics, scheduledPosts, schedulerAccounts, type ScheduledPost, type SchedulerAccount } from "@shared/schema";
import { fetchBufferPosts } from "./providers/buffer";
import { fetchZernioMetrics, fetchZernioPublishedPosts } from "./providers/zernio";
import { BUFFER_PLATFORMS, ZERNIO_PLATFORMS } from "./platforms";
import { TIMEZONE, todayISOInTimezone } from "./buildSchedule";
import type { MetricsByPostId, MetricsSnapshot, ProviderPostsById, ProviderResults, SchedulerPlatform } from "./types";

// How far back to keep refreshing a post's numbers. Engagement on this kind
// of short-form content is overwhelmingly front-loaded, so past this point a
// daily re-fetch mostly rewrites the same values -- and this is what bounds
// the table's growth rather than letting every post accumulate snapshots
// forever. It is NOT the retention window: rows already captured stay until
// the post itself ages out (see deleteMetricsForExpiredPosts).
const ACTIVE_WINDOW_DAYS = 14;

// Zernio's platform vocabulary differs from ours ("facebook" vs our
// "facebook_page"); see ZERNIO_PLATFORM_KEY in providers/zernio.ts, which
// this mirrors in reverse for the fallback matcher.
const ZERNIO_PLATFORM_FROM_KEY: Record<string, SchedulerPlatform> = {
  threads: "threads",
  facebook: "facebook_page",
  facebook_page: "facebook_page",
};

// How close a Zernio-reported publish time must be to our own recorded
// posting time to be considered the same post. Slots are hours apart, so an
// hour of slack is generous without risking a wrong pairing.
const TIME_MATCH_TOLERANCE_MS = 60 * 60 * 1000;

function providerPostId(post: ScheduledPost, platform: SchedulerPlatform): string | undefined {
  const results = (post.providerResults as ProviderResults | null) ?? {};
  const entry = results[platform];
  return entry?.ok ? entry.postId : undefined;
}

function succeededPlatforms(post: ScheduledPost): SchedulerPlatform[] {
  const results = (post.providerResults as ProviderResults | null) ?? {};
  return (post.platforms as SchedulerPlatform[]).filter((platform) => results[platform]?.ok === true);
}

// Pairs a post/platform with Zernio numbers when no provider id was ever
// stored for it. Every Threads/Facebook post dispatched before the id
// capture was fixed is in this state (18 of them at the time of writing),
// so without this they would simply never get metrics.
function matchByTime(
  candidates: Array<{ platform: string; publishedAt: Date; metrics: MetricsSnapshot }>,
  platform: SchedulerPlatform,
  postedAt: Date | null
): MetricsSnapshot | undefined {
  if (!postedAt) return undefined;

  let best: { metrics: MetricsSnapshot; distance: number } | undefined;
  for (const candidate of candidates) {
    if (ZERNIO_PLATFORM_FROM_KEY[candidate.platform] !== platform) continue;
    const distance = Math.abs(candidate.publishedAt.getTime() - postedAt.getTime());
    if (distance > TIME_MATCH_TOLERANCE_MS) continue;
    if (!best || distance < best.distance) best = { metrics: candidate.metrics, distance };
  }
  return best?.metrics;
}

function toRow(post: ScheduledPost, platform: SchedulerPlatform, snapshot: MetricsSnapshot, capturedOn: string) {
  return {
    scheduledPostId: post.id,
    platform,
    capturedOn,
    capturedAt: new Date(),
    providerUpdatedAt: snapshot.providerUpdatedAt ?? null,
    views: snapshot.views ?? null,
    impressions: snapshot.impressions ?? null,
    reach: snapshot.reach ?? null,
    reactions: snapshot.reactions ?? null,
    comments: snapshot.comments ?? null,
    shares: snapshot.shares ?? null,
    saves: snapshot.saves ?? null,
    clicks: snapshot.clicks ?? null,
    follows: snapshot.follows ?? null,
    engagementRate: snapshot.engagementRate != null ? String(snapshot.engagementRate) : null,
    raw: snapshot.raw ?? null,
  };
}

// Rewrites provider_results to reflect what the provider says actually
// happened, rather than what we assumed at hand-off time.
//
// A successful dispatch only means Buffer ACCEPTED the post -- publishing
// happens afterwards and can still fail. Measured against real accounts when
// this was written: 25 of 54 platform-posts we had recorded as ok:true had
// in fact failed to publish (YouTube 15/18, mostly "Invalid Credentials";
// the rest transient TikTok/Instagram errors). Every one of them displayed a
// green checkmark and was excluded from retry, because platformsNeedingDispatch()
// only considers platforms without ok:true.
//
// Flipping those to ok:false therefore does two things at once: it stops the
// UI lying, and it makes the existing per-post retry button pick them up
// automatically without any change to the retry path.
//
// Only an explicit `error` status counts as failure. "scheduled"/"sending"
// are healthy in-flight states -- posts handed over with a future
// scheduledAt legitimately sit in them until their slot arrives, and
// treating those as failures would retry posts that are about to publish
// normally, duplicating them.
function reconcileResults(post: ScheduledPost, bufferPosts: ProviderPostsById): ProviderResults | null {
  const results = (post.providerResults as ProviderResults | null) ?? {};
  let changed = false;
  const next: ProviderResults = { ...results };

  for (const platform of post.platforms as SchedulerPlatform[]) {
    if (!BUFFER_PLATFORMS.includes(platform)) continue;
    const entry = results[platform];
    if (!entry?.postId) continue;

    const state = bufferPosts.get(entry.postId)?.state;
    if (!state) continue;

    if (state.status === "error" && entry.ok !== false) {
      next[platform] = { ok: false, postId: entry.postId, error: state.errorMessage ?? "Gagal dipublikasikan oleh Buffer." };
      changed = true;
    } else if (state.status === "sent" && entry.ok !== true) {
      // The reverse case: a platform we recorded as failed that Buffer
      // actually published (e.g. a retry that errored on our side after the
      // provider had already accepted it). Correcting this prevents a retry
      // from posting it a second time.
      next[platform] = { ok: true, postId: entry.postId };
      changed = true;
    }
  }

  return changed ? next : null;
}

async function syncAccount(account: SchedulerAccount, since: Date, capturedOn: string) {
  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.schedulerAccountId, account.id),
        eq(scheduledPosts.status, "posted"),
        gte(scheduledPosts.scheduledFor, since)
      )
    );
  if (posts.length === 0) return { posts: 0, rows: 0 };

  // Both providers are hit once for the whole account rather than once per
  // post -- Buffer's `posts` query and Zernio's /analytics listing each
  // return every recent post in one (paginated) response.
  const [bufferPosts, zernioMetrics, zernioPublished] = await Promise.all([
    fetchBufferPosts(account, since).catch((): ProviderPostsById => new Map()),
    fetchZernioMetrics(account, since).catch((): MetricsByPostId => new Map()),
    fetchZernioPublishedPosts(account, since).catch(() => []),
  ]);

  // Correct the recorded outcomes BEFORE collecting metrics, so a post that
  // turns out to have failed doesn't also get a metrics row written for it.
  let reconciled = 0;
  for (const post of posts) {
    const next = reconcileResults(post, bufferPosts);
    if (!next) continue;

    const outcomes = Object.values(next);
    const allFailed = outcomes.length > 0 && outcomes.every((r) => !r.ok);
    await db
      .update(scheduledPosts)
      .set({
        providerResults: next,
        // Mirrors dispatchScheduledPost's own rule: "posted" means at least
        // one platform succeeded, "failed" means none did.
        status: allFailed ? "failed" : "posted",
        errorMessage: allFailed ? outcomes.map((r) => r.error).filter(Boolean).join("; ") : null,
      })
      .where(eq(scheduledPosts.id, post.id));
    post.providerResults = next;
    reconciled++;
  }

  const rows: ReturnType<typeof toRow>[] = [];
  for (const post of posts) {
    for (const platform of succeededPlatforms(post)) {
      const isBuffer = BUFFER_PLATFORMS.includes(platform);

      const id = providerPostId(post, platform);
      let snapshot = id ? (isBuffer ? bufferPosts.get(id)?.metrics ?? undefined : zernioMetrics.get(id)) : undefined;

      // Time-based fallback is Zernio-only: Buffer has always stored an id,
      // so a miss there means the post genuinely has no metrics yet (its
      // once-daily ingestion hasn't run), not that we failed to match it.
      if (!snapshot && ZERNIO_PLATFORMS.includes(platform)) {
        snapshot = matchByTime(zernioPublished, platform, post.postedAt);
      }
      if (!snapshot) continue;

      rows.push(toRow(post, platform, snapshot, capturedOn));
    }
  }

  if (rows.length > 0) {
    // Upsert on (post, platform, day): syncing several times a day refreshes
    // that day's row in place instead of stacking near-duplicates.
    await db
      .insert(postMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [postMetrics.scheduledPostId, postMetrics.platform, postMetrics.capturedOn],
        set: {
          capturedAt: sql`excluded.captured_at`,
          providerUpdatedAt: sql`excluded.provider_updated_at`,
          views: sql`excluded.views`,
          impressions: sql`excluded.impressions`,
          reach: sql`excluded.reach`,
          reactions: sql`excluded.reactions`,
          comments: sql`excluded.comments`,
          shares: sql`excluded.shares`,
          saves: sql`excluded.saves`,
          clicks: sql`excluded.clicks`,
          follows: sql`excluded.follows`,
          engagementRate: sql`excluded.engagement_rate`,
          raw: sql`excluded.raw`,
        },
      });
  }

  return { posts: posts.length, rows: rows.length, reconciled };
}

// Captures one day's performance snapshot for every recently-posted item
// across all active accounts. Safe to run several times a day (the upsert
// makes repeat runs idempotent within a calendar day) and safe to miss a
// run -- the only cost of a gap is one missing day in the series.
export async function syncPostMetrics() {
  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const capturedOn = todayISOInTimezone(TIMEZONE);

  // Accounts are independent (separate provider credentials, separate posts),
  // so one account's provider outage shouldn't stall or fail the others.
  const summary = await Promise.all(
    accounts.map(async (account) => {
      try {
        const result = await syncAccount(account, since, capturedOn);
        return { account: account.label, ...result };
      } catch (err) {
        return { account: account.label, posts: 0, rows: 0, reconciled: 0, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  return { capturedOn, accounts: summary };
}

// Retention: metrics live exactly as long as the post they describe, so the
// dashboard always covers a rolling 30-day window. Tied to the post's age
// rather than the row's own age so a post's history disappears all at once
// instead of eroding from the oldest snapshot forward.
//
// Called from the purge-trash cron, which already runs daily on the same
// 30-day threshold -- keeping one retention rule in one place.
export async function deleteMetricsForExpiredPosts(cutoff: Date): Promise<number> {
  const expired = await db
    .select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(sql`${scheduledPosts.scheduledFor} < ${cutoff}`);
  if (expired.length === 0) return 0;

  const deleted = await db
    .delete(postMetrics)
    .where(inArray(postMetrics.scheduledPostId, expired.map((row) => row.id)))
    .returning({ id: postMetrics.id });

  return deleted.length;
}
