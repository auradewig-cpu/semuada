import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents, type VideoContent } from "@shared/schema";

// Claims up to `count` oldest unclaimed videos in `category` for a single
// scheduler account, atomically. Written as ONE UPDATE...WHERE id IN
// (SELECT ... FOR UPDATE SKIP LOCKED) statement rather than db.transaction()
// -- this project's neon-http driver has no multi-statement transaction
// support, but Postgres already guarantees a single statement is atomic, and
// FOR UPDATE SKIP LOCKED inside the subquery is exactly the standard
// race-safe "claim a job from a shared queue" idiom. This is what stops two
// scheduler accounts sharing a category from ever being handed the same
// video, and stops two concurrent cron invocations from double-claiming.
export async function claimNextVideos(category: string, count: number): Promise<VideoContent[]> {
  if (count <= 0) return [];

  const candidates = db
    .select({ id: videoContents.id })
    .from(videoContents)
    .where(and(eq(videoContents.category, category), eq(videoContents.status, "uploaded")))
    .orderBy(asc(videoContents.createdAt))
    .limit(count)
    .for("update", { skipLocked: true });

  return db
    .update(videoContents)
    .set({ status: "scheduled" })
    .where(inArray(videoContents.id, candidates))
    .returning();
}
