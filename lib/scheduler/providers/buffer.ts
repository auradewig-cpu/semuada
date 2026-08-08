import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults } from "../types";

// Buffer's GraphQL API. Base URL confirmed against Buffer's own guide:
// GraphQL requests POST directly to https://api.buffer.com (no /graphql
// suffix -- Buffer's API is GraphQL-only, so the root IS the endpoint).
//
// The exact CreatePostInput/PostActionPayload shape below is confirmed via a
// live GraphQL introspection query against this endpoint (2026-08-09), not
// just documentation -- a real scheduler_accounts row's Buffer API key was
// used for a read-only __type query (no post was created; introspection
// can't mutate anything). Confirmed real shape, notably different from
// Buffer's own docs examples in a few places:
//   - channelId (singular), not profileIds (array)
//   - assets: [{ video: { url } }], not media: { type, url }
//   - mode: shareNow | customScheduled (+ dueAt), not a `now` boolean
//   - schedulingType and needsApproval are both required fields
//   - createPost returns a UNION (PostActionPayload), so the result must be
//     selected via inline fragments (`... on X`), not a bare `id` field --
//     this was the exact bug that produced the first real failure ("Cannot
//     query field \"id\" on type \"PostActionPayload\"").
// Not yet confirmed: an actual live createPost call succeeding end-to-end
// (introspection doesn't execute the mutation) -- the next real dispatch is
// the first true test of this.
const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post { id }
      }
      ... on InvalidInputError { message }
      ... on UnauthorizedError { message }
      ... on UnexpectedError { message }
      ... on NotFoundError { message }
      ... on RestProxyError { message }
      ... on LimitReachedError { message }
    }
  }
`;

function captionText(video: VideoContent): string {
  return [video.caption, ...(video.hashtags ?? []).map((h) => `#${h}`)].filter(Boolean).join("\n\n");
}

// scheduledAt omitted -> shareNow (publish immediately; used by the
// "Jadwalkan & Post Sekarang" manual button). scheduledAt provided ->
// customScheduled with dueAt (hand off to Buffer's own scheduler for that
// exact time; used by the daily 01:00 auto-build, so the actual
// publish-moment precision is Buffer's job, not our cron's).
export async function postToBuffer(account: SchedulerAccount, video: VideoContent, platforms: SchedulerPlatform[], scheduledAt?: Date): Promise<ProviderResults> {
  const results: ProviderResults = {};
  if (!account.bufferApiKey) {
    for (const p of platforms) results[p] = { ok: false, error: "Buffer API key belum diisi." };
    return results;
  }

  const text = captionText(video);

  for (const platform of platforms) {
    const channelId = account[ACCOUNT_ID_FIELD[platform]];
    if (!channelId) {
      results[platform] = { ok: false, error: `Account ID ${platform} belum diisi di akun "${account.label}".` };
      continue;
    }
    try {
      const response = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.bufferApiKey}` },
        body: JSON.stringify({
          query: CREATE_POST_MUTATION,
          variables: {
            input: {
              channelId,
              text,
              assets: [{ video: { url: video.videoUrl } }],
              schedulingType: "automatic",
              needsApproval: false,
              ...(scheduledAt
                ? { mode: "customScheduled", dueAt: scheduledAt.toISOString() }
                : { mode: "shareNow" }),
            },
          },
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.errors) {
        results[platform] = { ok: false, error: json?.errors?.[0]?.message ?? `HTTP ${response.status}` };
        continue;
      }
      const payload = json?.data?.createPost;
      if (payload?.__typename && payload.__typename !== "PostActionSuccess") {
        results[platform] = { ok: false, error: payload.message ?? `Buffer menolak permintaan (${payload.__typename}).` };
        continue;
      }
      results[platform] = { ok: true, postId: payload?.post?.id };
    } catch (err) {
      results[platform] = { ok: false, error: err instanceof Error ? err.message : "Gagal memanggil Buffer API." };
    }
  }

  return results;
}
