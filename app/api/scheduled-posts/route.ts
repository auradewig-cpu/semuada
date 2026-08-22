import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { scheduledPosts, videoContents } from "@shared/schema";
import { toApiScheduledPost } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

// Enough to cover several days across all nine accounts in one load, which is
// what the tab is actually used for.
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

// Joined with videoContents so the UI can show a thumbnail/caption per queue
// row without a second round-trip per item.
export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const schedulerAccountId = request.nextUrl.searchParams.get("scheduler_account_id");

  // Paginated because this is an append-only log: ~8 rows/day today and triple
  // that once every account reaches 3 posts/day, and the Scheduler tab renders
  // a <video> element per row. Returning the whole history was fine at 116
  // rows and would not have stayed fine.
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset")) || 0, 0);

  const query = db
    .select({ post: scheduledPosts, video: videoContents })
    .from(scheduledPosts)
    .innerJoin(videoContents, eq(scheduledPosts.videoContentId, videoContents.id))
    .orderBy(desc(scheduledPosts.scheduledFor))
    // One extra row is fetched purely to answer "is there more?" without a
    // second COUNT query; it is trimmed off before responding.
    .limit(limit + 1)
    .offset(offset);

  const rows = schedulerAccountId
    ? await query.where(eq(scheduledPosts.schedulerAccountId, schedulerAccountId))
    : await query;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    items: page.map(({ post, video }) => ({
      ...toApiScheduledPost(post),
      video_url: video.videoUrl,
      caption: video.caption,
      hashtags: video.hashtags,
      // The 30-day trash purge destroys the Cloudinary asset but keeps the
      // row (see removeVideo()), so video_url still points at something that
      // no longer exists. Flagged so the UI shows a placeholder rather than
      // a permanently-spinning video player on older posts.
      video_purged: video.purgedAt !== null,
    })),
  });
}
