import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents, type VideoContent } from "@shared/schema";

// One atomic claim of up to `count` oldest videos matching `where`.
//
// Written as ONE UPDATE...WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
// statement rather than db.transaction() -- this project's neon-http driver
// has no multi-statement transaction support, but Postgres already guarantees
// a single statement is atomic, and FOR UPDATE SKIP LOCKED inside the subquery
// is exactly the standard race-safe "claim a job from a shared queue" idiom.
// This is what stops two scheduler accounts sharing a category from ever being
// handed the same video, and stops two concurrent cron invocations from
// double-claiming.
function claimOldest(where: ReturnType<typeof and>, count: number) {
  const candidates = db
    .select({ id: videoContents.id })
    .from(videoContents)
    .where(where)
    .orderBy(asc(videoContents.createdAt))
    .limit(count)
    .for("update", { skipLocked: true });

  return db
    .update(videoContents)
    .set({ status: "scheduled" })
    .where(inArray(videoContents.id, candidates))
    .returning();
}

// Claims up to `count` videos for ONE scheduler account, in two stages:
//
//   1. the account's own lane  -- videos reserved for it via
//      video_contents.scheduler_account_id
//   2. the shared pool         -- videos in its category reserved for nobody
//
// The asymmetry is the whole point. An account may borrow from the shared
// pool, but NO account can ever touch another's lane. That is what lets one
// account own a run of near-identical videos (30 angles of the same folding
// table) without a sibling account in the same category picking one up and
// publishing near-duplicate content elsewhere -- which is what gets related
// accounts flagged, and which had already happened here: 12 products went out
// on two accounts each, one of them on the very same day.
//
// Ordering inside a lane is FIFO on created_at, so upload order IS publish
// order: upload angle 1..30 and they go out 1..30.
//
// Two sequential statements are safe: each is individually atomic, and stage 1
// touches rows that by definition no other account is contending for.
export async function claimNextVideos(accountId: string, category: string, count: number): Promise<VideoContent[]> {
  if (count <= 0) return [];

  // The category predicate is redundant against a correctly-assigned lane (the
  // API refuses cross-category assignment) but is kept here so the invariant
  // holds locally instead of resting on a check in another file. An account
  // must never publish outside its own category, whatever the lane says.
  const fromLane = await claimOldest(
    and(
      eq(videoContents.schedulerAccountId, accountId),
      eq(videoContents.category, category),
      eq(videoContents.status, "uploaded")
    ),
    count
  );
  if (fromLane.length >= count) return fromLane;

  // Only rows reserved for nobody -- `isNull` here is what keeps another
  // account's lane out of reach.
  const fromSharedPool = await claimOldest(
    and(
      isNull(videoContents.schedulerAccountId),
      eq(videoContents.category, category),
      eq(videoContents.status, "uploaded")
    ),
    count - fromLane.length
  );

  return [...fromLane, ...fromSharedPool];
}
