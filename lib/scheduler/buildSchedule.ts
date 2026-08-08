import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts, type SchedulerAccount } from "@shared/schema";
import { computeSlotTimes, slotTimeToDate } from "./rotation";
import { claimNextVideos } from "./videoPool";
import { resolveConfiguredPlatforms } from "./platforms";

export const TIMEZONE = "Asia/Jakarta";

export function todayISOInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type BuildResult = { status: "already_built" } | { status: "built"; slotsBuilt: number; slotsSkipped: number };

// Builds today's queue for ONE account: rotated slot times -> claim that many
// videos from the pool -> insert queued scheduled_posts rows -> advance
// rotationDayIndex. Called from both the daily cron and the manual
// "Jadwalkan Sekarang" button, so this is the single place the same-day
// guard lives.
//
// The guard exists because of a real incident: a test loop called the old
// (unguarded) build endpoint twice in a row and double-claimed 18 videos,
// 12 of them already overdue, before it was caught and manually undone. This
// makes that structurally impossible instead of relying on "don't do that
// again" -- a second call for the same account on the same day is a no-op.
export async function buildScheduleForAccount(account: SchedulerAccount, todayISO: string): Promise<BuildResult> {
  if (account.lastBuiltDate === todayISO) {
    return { status: "already_built" };
  }

  const slotTimes = computeSlotTimes(account.baseTimes, account.incrementMinutes, account.capTime, account.rotationDayIndex);
  const platforms = resolveConfiguredPlatforms(account);
  const claimedVideos = await claimNextVideos(account.category, slotTimes.length);

  let built = 0;
  for (let i = 0; i < slotTimes.length; i++) {
    const video = claimedVideos[i];
    if (!video) continue;
    await db.insert(scheduledPosts).values({
      schedulerAccountId: account.id,
      videoContentId: video.id,
      scheduledFor: slotTimeToDate(todayISO, slotTimes[i], TIMEZONE),
      platforms,
      status: "queued",
    });
    built++;
  }

  // Advances once per successful run regardless of how many slots actually
  // got a video -- rotation keeps moving even on a day the pool ran dry, so
  // it doesn't "catch up" oddly once videos are added again. See the
  // rotationDayIndex comment on the schema for the full rationale.
  await db
    .update(schedulerAccounts)
    .set({ rotationDayIndex: account.rotationDayIndex + 1, lastBuiltDate: todayISO })
    .where(eq(schedulerAccounts.id, account.id));

  return { status: "built", slotsBuilt: built, slotsSkipped: slotTimes.length - built };
}
