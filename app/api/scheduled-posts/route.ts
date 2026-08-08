import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { scheduledPosts, videoContents } from "@shared/schema";
import { toApiScheduledPost } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

// Joined with videoContents so the UI can show a thumbnail/caption per queue
// row without a second round-trip per item.
export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const schedulerAccountId = request.nextUrl.searchParams.get("scheduler_account_id");

  const query = db
    .select({ post: scheduledPosts, video: videoContents })
    .from(scheduledPosts)
    .innerJoin(videoContents, eq(scheduledPosts.videoContentId, videoContents.id))
    .orderBy(desc(scheduledPosts.scheduledFor));

  const rows = schedulerAccountId
    ? await query.where(eq(scheduledPosts.schedulerAccountId, schedulerAccountId))
    : await query;

  return NextResponse.json({
    items: rows.map(({ post, video }) => ({
      ...toApiScheduledPost(post),
      video_url: video.videoUrl,
      caption: video.caption,
      hashtags: video.hashtags,
    })),
  });
}
