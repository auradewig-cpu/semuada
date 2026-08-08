import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults } from "../types";

// Zernio, unlike Buffer, does NOT accept an arbitrary external URL in a post
// request -- confirmed via https://docs.zernio.com/guides/media-uploads:
// video bytes must be uploaded via a presigned URL first, then referenced by
// the publicUrl that upload returns.
//
// IMPORTANT: the platform key strings below ("threads", "facebook") are
// best-guess from Zernio's docs overview page, not a live schema/response
// check -- confirm the exact key Zernio expects for Facebook Page (may be
// "facebook_page" rather than "facebook") via a real GET /v1/accounts call
// before relying on this in production. Same caveat for the per-platform
// result shape in the createPost response, parsed defensively below.
const ZERNIO_API_BASE = "https://api.zernio.com";

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
  const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
  const videoBytes = await videoRes.arrayBuffer();

  const presignRes = await fetch(`${ZERNIO_API_BASE}/v1/media/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ filename: "video.mp4", contentType }),
  });
  if (!presignRes.ok) throw new Error(`Zernio presign gagal (${presignRes.status}).`);
  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: videoBytes });
  if (!putRes.ok) throw new Error(`Upload video ke Zernio gagal (${putRes.status}).`);

  return publicUrl;
}

export async function postToZernio(account: SchedulerAccount, video: VideoContent, platforms: SchedulerPlatform[]): Promise<ProviderResults> {
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

  try {
    const publicUrl = await uploadVideoToZernio(account.zernioApiKey, video.videoUrl);

    const postRes = await fetch(`${ZERNIO_API_BASE}/v1/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.zernioApiKey}` },
      body: JSON.stringify({
        content: captionText(video),
        mediaItems: [{ url: publicUrl, type: "video" }],
        platforms: validTargets.map((t) => ({ platform: ZERNIO_PLATFORM_KEY[t.platform], accountId: t.accountId })),
        // Publish immediately -- same reasoning as Buffer's `now: true` above,
        // our own schedule is the single source of truth for timing.
        publishNow: true,
      }),
    });
    const json = await postRes.json().catch(() => null);
    if (!postRes.ok) {
      const error = json?.error ?? `HTTP ${postRes.status}`;
      for (const t of validTargets) results[t.platform] = { ok: false, error };
      return results;
    }
    // Defensive: fall back to a flat "ok" per target if the response doesn't
    // break results out per platform (shape not confirmed -- see file header).
    for (const t of validTargets) {
      const perPlatform = json?.results?.[ZERNIO_PLATFORM_KEY[t.platform]];
      results[t.platform] = perPlatform
        ? { ok: perPlatform.status !== "failed", postId: perPlatform.id, error: perPlatform.error }
        : { ok: true, postId: json?.id };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Gagal memanggil Zernio API.";
    for (const t of validTargets) results[t.platform] = { ok: false, error };
  }

  return results;
}
