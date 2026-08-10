import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults, MetricsSnapshot, MetricsByPostId } from "../types";

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
// IMPORTANT: the platform key strings below ("threads", "facebook") are
// still best-guess from Zernio's docs overview page, not a live
// schema/response check -- confirm the exact key Zernio expects for
// Facebook Page (may be "facebook_page" rather than "facebook") via a real
// GET /accounts call before relying on this in production. Same caveat for
// the per-platform result shape in the createPost response, parsed
// defensively below, and for `scheduledAt` -- never exercised against a real
// Zernio account, verify before trusting the daily auto-build flow with real
// accounts (a wrong/ignored field name could silently publish immediately
// instead of scheduling for later).
const ZERNIO_API_BASE = "https://zernio.com/api/v1";

const ZERNIO_PLATFORM_KEY: Record<"threads" | "facebook_page", string> = {
  threads: "threads",
  facebook_page: "facebook",
};

function captionText(video: VideoContent): string {
  return [video.caption, ...(video.hashtags ?? []).map((h) => `#${h}`)].filter(Boolean).join("\n\n");
}

// Zernio isn't consistent about which key carries a post's id (`_id` in the
// analytics payload, possibly `id`/`postId` elsewhere), and the exact
// create-post response shape still isn't confirmed against a live call --
// so try each rather than betting on one and silently storing nothing.
function zernioPostId(source: unknown): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of ["_id", "id", "postId"]) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

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

// scheduledAt omitted -> publish immediately (manual "Jadwalkan & Post
// Sekarang" button). scheduledAt provided -> hand off to Zernio's own
// scheduler for that exact time (daily 01:00 auto-build).
export async function postToZernio(account: SchedulerAccount, video: VideoContent, platforms: SchedulerPlatform[], scheduledAt?: Date): Promise<ProviderResults> {
  const results: ProviderResults = {};
  if (!account.zernioApiKey) {
    for (const p of platforms) results[p] = { ok: false, error: "Zernio API key belum diisi." };
    return results;
  }

  const targets = platforms
    .filter((p): p is "threads" | "facebook_page" => p === "threads" || p === "facebook_page")
    .map((platform) => {
      const accountId = account[ACCOUNT_ID_FIELD[platform]];
      return accountId ? { platform, accountId } : null;
    });

  for (let i = 0; i < platforms.length; i++) {
    if (!targets[i]) {
      results[platforms[i]] = { ok: false, error: `Account ID ${platforms[i]} belum diisi di akun "${account.label}".` };
    }
  }
  const validTargets = targets.filter((t): t is { platform: "threads" | "facebook_page"; accountId: string } => t !== null);
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
            ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : { publishNow: true }),
          }),
        });
        const json = await postRes.json().catch(() => null);
        if (!postRes.ok) {
          results[t.platform] = { ok: false, error: json?.error ?? `HTTP ${postRes.status}` };
          return;
        }
        // Defensive: fall back to a flat "ok" if the response doesn't break
        // results out per platform (shape not confirmed -- see file header).
        //
        // The id is read through several candidate keys because the original
        // `json?.id` alone silently captured nothing: Zernio's own analytics
        // payload keys its posts as `_id`, and all 18 real Threads/Facebook
        // posts ended up stored with no postId at all, leaving them
        // unmatchable to their performance data. Buffer's side stored one
        // every time, which is what made the gap obvious.
        const perPlatform = json?.results?.[ZERNIO_PLATFORM_KEY[t.platform]];
        results[t.platform] = perPlatform
          ? { ok: perPlatform.status !== "failed", postId: zernioPostId(perPlatform), error: perPlatform.error }
          : { ok: true, postId: zernioPostId(json) };
      } catch (err) {
        results[t.platform] = { ok: false, error: err instanceof Error ? err.message : "Gagal memanggil Zernio API." };
      }
    }),
  );

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
