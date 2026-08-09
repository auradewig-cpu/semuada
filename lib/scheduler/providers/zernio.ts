import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults } from "../types";

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
        const perPlatform = json?.results?.[ZERNIO_PLATFORM_KEY[t.platform]];
        results[t.platform] = perPlatform
          ? { ok: perPlatform.status !== "failed", postId: perPlatform.id, error: perPlatform.error }
          : { ok: true, postId: json?.id };
      } catch (err) {
        results[t.platform] = { ok: false, error: err instanceof Error ? err.message : "Gagal memanggil Zernio API." };
      }
    }),
  );

  return results;
}
