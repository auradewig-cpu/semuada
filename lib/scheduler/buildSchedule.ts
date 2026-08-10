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

export type BuildResult =
  | { status: "already_built" }
  | { status: "built"; slotsBuilt: number; slotsSkipped: number; slotsAllowed: number };

// Days at each posting frequency before stepping up: 1/day for the first 30
// days, 2/day for the next 30, then 3/day from day 60 on.
export const RAMP_PHASE_DAYS = 30;

// How many of an account's baseTimes are live today. Slots are enabled from
// the FRONT of baseTimes, which is why that array is ordered by priority
// rather than by clock -- a once-a-day account should be posting in its best
// hour, not merely its earliest.
//
// An account with no rampStartedAt uses every slot it has, so existing
// accounts (and anyone editing times by hand) keep working unchanged.
export function activeSlotCount(account: Pick<SchedulerAccount, "baseTimes" | "rampStartedAt">, now: Date): number {
  if (!account.rampStartedAt) return account.baseTimes.length;
  const daysLive = Math.floor((now.getTime() - account.rampStartedAt.getTime()) / (24 * 60 * 60 * 1000));
  // Clamped at 1 so a rampStartedAt in the future (a scheduled launch, or
  // clock skew) still posts once a day rather than going silent.
  const phase = Math.max(1, Math.floor(daysLive / RAMP_PHASE_DAYS) + 1);
  return Math.min(phase, account.baseTimes.length);
}

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

  // Ramp first, rotate second: the drift window is derived from the latest
  // baseTime, which is baseTimes[0] under the priority ordering, so slicing
  // before rotating keeps the window identical across all three phases.
  const allowed = activeSlotCount(account, new Date());
  const rampedBaseTimes = account.baseTimes.slice(0, allowed);
  const slotTimes = computeSlotTimes(rampedBaseTimes, account.incrementMinutes, account.capTime, account.rotationDayIndex);
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

  return { status: "built", slotsBuilt: built, slotsSkipped: slotTimes.length - built, slotsAllowed: allowed };
}
