import type { SchedulerAccount, VideoContent } from "@shared/schema";
import { ACCOUNT_ID_FIELD } from "../platforms";
import type { SchedulerPlatform, ProviderResults, MetricsSnapshot, MetricsByPostId } from "../types";

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

// Fetches performance numbers for every post this Buffer account sent since
// `since`, in ONE paginated query rather than one call per post.
//
// Confirmed against the live API (2026-08-10): `posts` accepts
// filter.status/filter.dueAt and returns `metrics` inline, so a real account
// with 11 recent posts came back in a single request. Per-post `post(input:)`
// lookups would have meant hundreds of round-trips per sync for the same data.
//
// Note the date comparator is `{ start, end }` -- NOT the `gte`/`lte` shape
// GraphQL APIs usually use, which the schema rejects outright.
const POSTS_METRICS_QUERY = `
  query PostMetrics($orgId: OrganizationId!, $since: DateTime!, $after: String) {
    posts(
      input: { organizationId: $orgId, filter: { status: sent, dueAt: { start: $since } } }
      first: 50
      after: $after
    ) {
      edges {
        node {
          id
          metricsUpdatedAt
          metrics { type value }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// Buffer reports metrics as a flat list of {type, value} rather than named
// fields, so they're folded into our own shape here. Unmapped types are kept
// in `raw` instead of dropped -- Buffer's enum includes network-specific
// entries (saves, quotes, totalTimeWatched, ...) we don't model as columns.
function toSnapshot(metrics: Array<{ type: string; value: number }>, metricsUpdatedAt: string | null): MetricsSnapshot {
  const byType = new Map(metrics.map((m) => [m.type, m.value]));
  const take = (type: string) => (byType.has(type) ? byType.get(type) : undefined);

  const mapped = new Set(["views", "impressions", "reach", "reactions", "comments", "shares", "saves", "clicks", "follows", "engagementRate"]);
  const raw: Record<string, unknown> = {};
  for (const [type, value] of byType) {
    if (!mapped.has(type)) raw[type] = value;
  }

  return {
    views: take("views"),
    impressions: take("impressions"),
    reach: take("reach"),
    reactions: take("reactions"),
    comments: take("comments"),
    shares: take("shares"),
    saves: take("saves"),
    clicks: take("clicks"),
    follows: take("follows"),
    engagementRate: take("engagementRate"),
    providerUpdatedAt: metricsUpdatedAt ? new Date(metricsUpdatedAt) : undefined,
    raw: Object.keys(raw).length > 0 ? raw : undefined,
  };
}

export async function fetchBufferMetrics(account: SchedulerAccount, since: Date): Promise<MetricsByPostId> {
  const results: MetricsByPostId = new Map();
  if (!account.bufferApiKey) return results;

  const call = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.bufferApiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  };

  // The organization id isn't stored on our side -- it belongs to whoever
  // owns the API key, so it's resolved per account rather than assumed.
  const accountRes = await call(`{ account { organizations { id } } }`, {});
  const orgId: string | undefined = accountRes?.data?.account?.organizations?.[0]?.id;
  if (!orgId) return results;

  let after: string | null = null;
  // Bounded so a pagination bug on either side can't spin forever; 20 pages
  // x 50 posts is far beyond what this account volume can produce.
  for (let page = 0; page < 20; page++) {
    const res = await call(POSTS_METRICS_QUERY, { orgId, since: since.toISOString(), after });
    const connection = res?.data?.posts;
    if (!connection) break;

    for (const edge of connection.edges ?? []) {
      const node = edge?.node;
      // Buffer returns metrics: null until its daily ingestion has run --
      // skip rather than recording a row of zeroes that would look like real
      // "no engagement" data.
      if (!node?.id || !node.metrics) continue;
      results.set(node.id, toSnapshot(node.metrics, node.metricsUpdatedAt ?? null));
    }

    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
  }

  return results;
}

// YouTube and Instagram are the only two platforms Buffer rejects without
// platform-specific metadata (confirmed by the first real dispatch's actual
// error text: "YouTube posts require a title., YouTube posts require a
// category." / "Instagram posts require a type (post, story, or reel)."),
// found via the CreatePostInput -> metadata -> {youtube,instagram} nested
// input types (introspected 2026-08-09, same session as the base schema).
// TikTok's metadata is fully optional (title only, no error was raised for
// it), so it's left unset.
const YOUTUBE_TITLE_MAX_LENGTH = 100;
// YouTube's fixed category taxonomy has no per-video categorization in this
// app; "26" (Howto & Style) is a reasonable fixed default for this account's
// "Perawatan & Kecantikan" (skincare/beauty) product content.
const YOUTUBE_CATEGORY_ID = "26";

function youtubeTitle(video: VideoContent): string {
  const raw = video.caption?.trim() || "Video Produk";
  return raw.length > YOUTUBE_TITLE_MAX_LENGTH ? `${raw.slice(0, YOUTUBE_TITLE_MAX_LENGTH - 1)}…` : raw;
}

function metadataForPlatform(platform: SchedulerPlatform, video: VideoContent): Record<string, unknown> | undefined {
  if (platform === "youtube") {
    return { youtube: { title: youtubeTitle(video), categoryId: YOUTUBE_CATEGORY_ID } };
  }
  if (platform === "instagram") {
    return { instagram: { type: "reel", shouldShareToFeed: true } };
  }
  return undefined;
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
    const metadata = metadataForPlatform(platform, video);
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
              ...(metadata ? { metadata } : {}),
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
