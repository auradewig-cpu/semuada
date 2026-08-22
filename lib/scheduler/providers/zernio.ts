import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults, MetricsSnapshot, MetricsByPostId, ProviderPostsById } from "../types";

// Zernio, unlike Buffer, does NOT accept an arbitrary external URL in a post
// request -- confirmed via https://docs.zernio.com/guides/media-uploads:
// video bytes must be uploaded via a presigned URL first, then referenced by
// the publicUrl that upload returns.
//
// Base URL confirmed against the quickstart guide's own curl example
// (`curl https://zernio.com/api/v1/posts ...`) -- NOT a subdomain.
//
// The presign request shape (filename, contentType), response shape
// (uploadUrl, publicUrl), base URL, and Bearer auth format below are
// confirmed against docs.zernio.com's own worked example (2026-08-09) and
// match this file exactly. The first real dispatch's "Zernio presign gagal
// (400)" root cause (once the discarded response body was surfaced) turned
// out to be the contentType VALUE, not a field-name mismatch: Cloudinary's
// Content-Type header includes a codec parameter ("video/mp4;codecs=avc1")
// that Zernio's strict enum validator rejects outright -- fixed below by
// stripping to the bare MIME type before sending.
//
// The platform keys below ("threads", "facebook") are confirmed against real
// GET /v1/accounts responses.
//
// The caveat that used to sit here -- that the scheduling field had never been
// exercised against a real account -- turned out to be exactly right, and went
// unheeded for 13 days. It cost Threads and Facebook Page every single post
// between 2026-08-10 and 2026-08-22. Both the field name and the response
// shape are now checked against Zernio's own published API reference, and the
// code no longer treats a 200 as proof of anything (see postToZernio).
// Lesson worth keeping: an unverified field name in a write path is not a
// documentation gap, it is an outage waiting for a schedule change.
const ZERNIO_API_BASE = "https://zernio.com/api/v1";

const ZERNIO_PLATFORM_KEY: Record<"threads" | "facebook_page", string> = {
  threads: "threads",
  facebook_page: "facebook",
};

function captionText(video: VideoContent): string {
  return [video.caption, ...(video.hashtags ?? []).map((h) => `#${h}`)].filter(Boolean).join("\n\n");
}

// Zernio isn't consistent about which key carries a post's id (`_id` in the
// analytics payload, possibly `id`/`postId` elsewhere), so try each rather
// than betting on one and silently storing nothing.
function zernioPostId(source: unknown): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of ["_id", "id", "postId"]) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

// POST /v1/posts answers `{ post: { _id, status, ... } }` -- the created post
// is wrapped, which is why reading the id off the top level stored nothing for
// every Threads/Facebook post ever dispatched.
function zernioCreatedPost(json: unknown): Record<string, unknown> | undefined {
  if (!json || typeof json !== "object") return undefined;
  const record = json as Record<string, unknown>;
  for (const key of ["post", "data"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  }
  return record;
}

// Zernio's post lifecycle: draft | scheduled | publishing | published |
// partial | failed. A "draft" is the dangerous one: the API answers 200 and
// the post looks accepted, but nothing will ever publish it -- which is
// exactly how Threads and Facebook Page went silent for 13 days while this
// app reported success (see the scheduledFor comment in postToZernio).
const ZERNIO_DEAD_STATUSES = new Set(["draft", "failed"]);

async function uploadVideoToZernio(apiKey: string, videoUrl: string): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Gagal mengambil video dari Cloudinary (${videoRes.status}).`);
  // Cloudinary's Content-Type header includes a codec parameter (observed:
  // "video/mp4;codecs=avc1") that Zernio's presign endpoint rejects outright
  // -- confirmed root cause of the first real dispatch's "Zernio presign
  // gagal (400)" via the surfaced response body: "Invalid option: expected
  // one of \"video/mp4\"|... param: contentType". Strip to the bare MIME type.
  const contentType = (videoRes.headers.get("content-type") ?? "video/mp4").split(";")[0].trim();
  const videoBytes = await videoRes.arrayBuffer();

  const presignRes = await fetch(`${ZERNIO_API_BASE}/media/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ filename: "video.mp4", contentType }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.text().catch(() => "");
    throw new Error(`Zernio presign gagal (${presignRes.status})${body ? `: ${body}` : ""}.`);
  }
  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: videoBytes });
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => "");
    throw new Error(`Upload video ke Zernio gagal (${putRes.status})${body ? `: ${body}` : ""}.`);
  }

  return publicUrl;
}

// Zernio's own words: "Neither [scheduledFor nor publishNow] -> saved as a
// draft to finish later." This code used to send `scheduledAt`, a field name
// Zernio does not know, so the daily auto-build silently created drafts:
// audited 2026-08-22 across all 9 accounts, 196 drafts and 0 scheduled, with
// the only published posts dating from 2026-08-09 -- the day before the cron
// switched from publishNow to scheduled hand-off. Threads and Facebook Page
// therefore published nothing for 13 days while this app reported success.
//
// `scheduledFor` must be an ISO datetime WITHOUT a zone suffix, interpreted in
// the separately-supplied `timezone`. Sending the UTC wall time with
// timezone "UTC" keeps the two halves consistent and needs no timezone
// conversion; the value Zernio stores back is UTC either way.
function zernioSchedule(scheduledAt?: Date): Record<string, unknown> {
  if (!scheduledAt) return { publishNow: true };
  return { scheduledFor: scheduledAt.toISOString().slice(0, 19), timezone: "UTC" };
}

// scheduledAt omitted -> publish immediately (manual "Jadwalkan & Post
// Sekarang" button). scheduledAt provided -> hand off to Zernio's own
// scheduler for that exact time (daily 01:00 auto-build).
export async function postToZernio(account: SchedulerAccount, video: VideoContent, platforms: SchedulerPlatform[], scheduledAt?: Date): Promise<ProviderResults> {
  const results: ProviderResults = {};
  if (!account.zernioApiKey) {
    for (const p of platforms) results[p] = { ok: false, error: "Zernio API key belum diisi." };
    return results;
  }

  // Built by walking `platforms` directly rather than indexing a filtered
  // array against the unfiltered one -- the old version only lined up because
  // every caller happened to pre-filter to Zernio platforms, so any new caller
  // would have attached errors to the wrong platform.
  const validTargets: Array<{ platform: "threads" | "facebook_page"; accountId: string }> = [];
  for (const platform of platforms) {
    if (platform !== "threads" && platform !== "facebook_page") continue;
    // ACCOUNT_ID_FIELD is keyed to `keyof SchedulerAccount`, so the lookup is
    // the union of every column type -- narrow it rather than assert.
    const accountId = account[ACCOUNT_ID_FIELD[platform]];
    if (typeof accountId === "string" && accountId) validTargets.push({ platform, accountId });
    else results[platform] = { ok: false, error: `Account ID ${platform} belum diisi di akun "${account.label}".` };
  }
  if (validTargets.length === 0) return results;

  let publicUrl: string;
  try {
    publicUrl = await uploadVideoToZernio(account.zernioApiKey, video.videoUrl);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Gagal mengunggah video ke Zernio.";
    for (const t of validTargets) results[t.platform] = { ok: false, error };
    return results;
  }

  // One POST /posts call PER target, not one batched call for all of them --
  // confirmed via a real dispatch that Zernio validates every target account
  // up front and rejects the WHOLE request if even one is broken (a
  // disconnected Facebook Page dragged down a perfectly healthy Threads
  // account, which wrongly got the same "disconnected" error even though its
  // own connection was fine). Splitting the calls means one broken platform
  // can no longer block a working one; the shared upload above still only
  // happens once.
  await Promise.all(
    validTargets.map(async (t) => {
      try {
        const postRes = await fetch(`${ZERNIO_API_BASE}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.zernioApiKey}` },
          body: JSON.stringify({
            content: captionText(video),
            mediaItems: [{ url: publicUrl, type: "video" }],
            platforms: [{ platform: ZERNIO_PLATFORM_KEY[t.platform], accountId: t.accountId }],
            ...zernioSchedule(scheduledAt),
          }),
        });
        const json = await postRes.json().catch(() => null);
        if (!postRes.ok) {
          results[t.platform] = { ok: false, error: json?.error ?? `HTTP ${postRes.status}` };
          return;
        }
        // A 200 is NOT success on its own. Zernio answers 200 for a draft too,
        // and a draft never publishes -- treating the HTTP status as the
        // verdict is what let Threads and Facebook Page go quiet for 13 days
        // with green ticks in the dashboard. Read the post's own status back.
        //
        // The id is read through several candidate keys because the original
        // `json?.id` alone silently captured nothing: the created post is
        // wrapped in `post`, so every Threads/Facebook post ever dispatched
        // was stored with no postId at all, leaving it unmatchable to its
        // performance data. Buffer's side stored one every time, which is
        // what made the gap obvious.
        const created = zernioCreatedPost(json);
        const status = typeof created?.status === "string" ? created.status : undefined;
        const perPlatform = json?.results?.[ZERNIO_PLATFORM_KEY[t.platform]];

        if (perPlatform) {
          results[t.platform] = {
            ok: perPlatform.status !== "failed",
            postId: zernioPostId(perPlatform) ?? zernioPostId(created),
            error: perPlatform.error,
          };
        } else if (status && ZERNIO_DEAD_STATUSES.has(status)) {
          results[t.platform] = {
            ok: false,
            postId: zernioPostId(created),
            error: `Zernio menyimpan post sebagai "${status}" -- tidak akan pernah terbit. Cek payload scheduledFor/publishNow.`,
          };
        } else {
          results[t.platform] = { ok: true, postId: zernioPostId(created) };
        }
      } catch (err) {
        results[t.platform] = { ok: false, error: err instanceof Error ? err.message : "Gagal memanggil Zernio API." };
      }
    }),
  );

  return results;
}

// Reads back what Zernio actually did with the posts we handed it, so the
// metrics sync can correct provider_results the same way it already does for
// Buffer. Without this, Zernio was write-only from our side: we recorded the
// hand-off and never looked again, which is precisely how Threads and Facebook
// Page sat at 116 ok / 0 failed in our database while ~100 of those posts had
// silently been saved as drafts and never published.
//
// Confirmed live (read-only, 2026-08-23):
//   GET /v1/posts?limit=100&page=N
//   -> { posts: [{ _id, status, scheduledFor, publishedAt, timezone,
//                  platforms: [{ platform, status, error }] }],
//        pagination: { totalPages, ... } }
//
// Note this endpoint returns drafts too, which /analytics does not -- that is
// the whole point. Filtering to published posts would hide exactly the
// failures this exists to catch.
//
// `since` filters client-side on scheduledFor: the endpoint has no date
// parameter, and the volume here (tens of posts per account) does not justify
// guessing at one.
export async function fetchZernioPosts(account: SchedulerAccount, since: Date): Promise<ProviderPostsById> {
  const results: ProviderPostsById = new Map();
  if (!account.zernioApiKey) return results;

  // Bounded like fetchBufferPosts' page loop -- a pagination bug on either
  // side must not spin forever.
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${ZERNIO_API_BASE}/posts?limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${account.zernioApiKey}` },
    });
    if (!res.ok) break;
    const json = await res.json().catch(() => null);
    const posts: unknown[] = json?.posts ?? [];
    if (posts.length === 0) break;

    for (const entry of posts) {
      const post = entry as Record<string, any>;
      const id = zernioPostId(post);
      if (!id) continue;
      const scheduledFor = typeof post.scheduledFor === "string" ? new Date(post.scheduledFor) : null;
      if (scheduledFor && !isNaN(scheduledFor.getTime()) && scheduledFor < since) continue;

      // One Zernio post carries exactly one platform in our usage (see the
      // "One POST /posts call PER target" note above), so its per-platform
      // entry is more specific than the post-level rollup and wins.
      const platform = post.platforms?.[0];
      const status: string = typeof platform?.status === "string" && platform.status !== "pending"
        ? platform.status
        : String(post.status ?? "");

      results.set(id, {
        metrics: null, // numbers come from /analytics, not from here
        state: {
          status,
          errorMessage: platform?.error ?? post.error ?? undefined,
          sentAt: typeof post.publishedAt === "string" ? new Date(post.publishedAt) : undefined,
        },
      });
    }

    const totalPages = json?.pagination?.totalPages;
    if (typeof totalPages === "number" && page >= totalPages) break;
  }

  return results;
}

// Metric keys Zernio returns per post AND per platform, mapped onto our own
// shape. Confirmed against a real GET /v1/analytics response (2026-08-10) on
// the current plan -- this base endpoint needs no paid Analytics add-on,
// unlike the /analytics/daily-metrics and per-platform *-insights endpoints.
const ZERNIO_MAPPED_KEYS = new Set([
  "views", "impressions", "reach", "likes", "comments", "shares", "saves", "clicks", "follows", "engagementRate", "lastUpdated",
]);

function toSnapshot(analytics: Record<string, unknown>): MetricsSnapshot {
  const num = (key: string): number | undefined => {
    const value = analytics[key];
    return typeof value === "number" ? value : undefined;
  };

  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(analytics)) {
    // Keeps Zernio-only fields (igReelsAvgWatchTime, videoDurationSeconds,
    // ...) rather than discarding them -- they can't be re-fetched later
    // once the post ages out of the analytics window.
    if (!ZERNIO_MAPPED_KEYS.has(key) && value !== null && value !== undefined) raw[key] = value;
  }

  // Zernio's `lastUpdated` is a plain "YYYY-MM-DD HH:mm:ss" string with no
  // timezone marker, so it's normalised to ISO before parsing rather than
  // left to the engine's locale-dependent fallback.
  const lastUpdated = typeof analytics.lastUpdated === "string" ? new Date(analytics.lastUpdated.replace(" ", "T") + "Z") : undefined;

  return {
    views: num("views"),
    impressions: num("impressions"),
    reach: num("reach"),
    // Zernio names it `likes`; our column follows Buffer's cross-network
    // "reactions" naming so both providers land in the same field.
    reactions: num("likes"),
    comments: num("comments"),
    shares: num("shares"),
    saves: num("saves"),
    clicks: num("clicks"),
    follows: num("follows"),
    engagementRate: num("engagementRate"),
    providerUpdatedAt: lastUpdated && !isNaN(lastUpdated.getTime()) ? lastUpdated : undefined,
    raw: Object.keys(raw).length > 0 ? raw : undefined,
  };
}

// Fetches performance data for this Zernio account's recent posts. One
// listing call covers every post (and its per-platform breakdown), so this
// is a handful of requests per sync rather than one per post.
//
// Returns entries keyed by BOTH the post id and each platform-specific id
// Zernio reports, because our own stored postId hasn't historically been
// reliable here (see zernioPostId above) -- indexing every id the response
// offers gives the matcher more than one way to connect a row.
export async function fetchZernioMetrics(account: SchedulerAccount, since: Date): Promise<MetricsByPostId> {
  const results: MetricsByPostId = new Map();
  if (!account.zernioApiKey) return results;

  const params = new URLSearchParams({ fromDate: since.toISOString().slice(0, 10), limit: "100" });
  const res = await fetch(`${ZERNIO_API_BASE}/analytics?${params.toString()}`, {
    headers: { Authorization: `Bearer ${account.zernioApiKey}` },
  });
  if (!res.ok) return results;

  const json = await res.json().catch(() => null);
  for (const post of json?.posts ?? []) {
    const postAnalytics = post?.analytics;
    if (postAnalytics) {
      const snapshot = toSnapshot(postAnalytics);
      for (const id of [post._id, post.latePostId]) {
        if (typeof id === "string" && id) results.set(id, snapshot);
      }
    }
    // Per-platform numbers are more precise than the post-level rollup when
    // one post fans out to several platforms, so they overwrite it.
    for (const entry of post?.platforms ?? []) {
      if (!entry?.analytics) continue;
      const snapshot = toSnapshot(entry.analytics);
      for (const id of [entry.platformPostId, post._id, post.latePostId]) {
        if (typeof id === "string" && id) results.set(id, snapshot);
      }
    }
  }

  return results;
}

// Exposed so the sync job can fall back to time-based matching for the
// Threads/Facebook posts dispatched before zernioPostId() existed, which
// have no stored provider id at all. Returns each published post's platform,
// publish time and metrics so the caller can pair them up by proximity.
export async function fetchZernioPublishedPosts(
  account: SchedulerAccount,
  since: Date
): Promise<Array<{ platform: string; publishedAt: Date; metrics: MetricsSnapshot }>> {
  const out: Array<{ platform: string; publishedAt: Date; metrics: MetricsSnapshot }> = [];
  if (!account.zernioApiKey) return out;

  const params = new URLSearchParams({ fromDate: since.toISOString().slice(0, 10), limit: "100" });
  const res = await fetch(`${ZERNIO_API_BASE}/analytics?${params.toString()}`, {
    headers: { Authorization: `Bearer ${account.zernioApiKey}` },
  });
  if (!res.ok) return out;

  const json = await res.json().catch(() => null);
  for (const post of json?.posts ?? []) {
    const publishedAt = typeof post?.publishedAt === "string" ? new Date(post.publishedAt) : null;
    if (!publishedAt || isNaN(publishedAt.getTime())) continue;
    for (const entry of post?.platforms ?? []) {
      if (!entry?.analytics || typeof entry.platform !== "string") continue;
      out.push({ platform: entry.platform, publishedAt, metrics: toSnapshot(entry.analytics) });
    }
  }

  return out;
}
