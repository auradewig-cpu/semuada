import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults } from "../types";

// Buffer's GraphQL API (confirmed: https://developers.buffer.com/guides/posts-and-scheduling.html)
// accepts a public media URL directly in createPost -- our Cloudinary
// videoUrl is already public, so unlike Zernio (see ../providers/zernio.ts)
// no upload step is needed here.
//
// IMPORTANT: the exact GraphQL field/argument names below are written from
// Buffer's documented shape at the time this feature was designed, not from
// a live schema introspection. Run one real call against Buffer's GraphQL
// API with a real API key (e.g. via their API explorer) before relying on
// this in production, and adjust field names if Buffer's actual schema
// differs -- particularly the `media` input shape and whatever field
// signals "publish now" vs "schedule for later".
const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com/2/graphql";

function captionText(video: VideoContent): string {
  return [video.caption, ...(video.hashtags ?? []).map((h) => `#${h}`)].filter(Boolean).join("\n\n");
}

export async function postToBuffer(account: SchedulerAccount, video: VideoContent, platforms: SchedulerPlatform[]): Promise<ProviderResults> {
  const results: ProviderResults = {};
  if (!account.bufferApiKey) {
    for (const p of platforms) results[p] = { ok: false, error: "Buffer API key belum diisi." };
    return results;
  }

  const text = captionText(video);

  for (const platform of platforms) {
    const profileId = account[ACCOUNT_ID_FIELD[platform]];
    if (!profileId) {
      results[platform] = { ok: false, error: `Account ID ${platform} belum diisi di akun "${account.label}".` };
      continue;
    }
    try {
      const response = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.bufferApiKey}` },
        body: JSON.stringify({
          query: `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { id } }`,
          variables: {
            input: {
              profileIds: [profileId],
              text,
              media: { type: "video", url: video.videoUrl },
              // Publish immediately rather than scheduling further inside
              // Buffer -- our own rotation schedule (lib/scheduler/rotation.ts)
              // is the single source of truth for timing; Buffer is only
              // called when it's actually time to post (see dispatch.ts).
              now: true,
            },
          },
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.errors) {
        results[platform] = { ok: false, error: json?.errors?.[0]?.message ?? `HTTP ${response.status}` };
        continue;
      }
      results[platform] = { ok: true, postId: json?.data?.createPost?.id };
    } catch (err) {
      results[platform] = { ok: false, error: err instanceof Error ? err.message : "Gagal memanggil Buffer API." };
    }
  }

  return results;
}
