import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts, type SchedulerAccount } from "@shared/schema";
import { activeSlotCount, computeSlotTimes, slotTimeToDate } from "./rotation";
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
  | { status: "no_platforms" }
  | { status: "built"; slotsBuilt: number; slotsSkipped: number; slotsAllowed: number };

// activeSlotCount / RAMP_PHASE_DAYS live in ./rotation, which has no server
// imports, so the admin UI can share the exact same rule instead of
// reimplementing it (it needs to know how many slots an account should be
// filling today, or it reports false "video kurang" warnings).

// Builds today's queue for ONE account: rotated slot times -> claim that many
// videos from the pool -> insert queued scheduled_posts rows -> advance
// rotationDayIndex. Called from both the daily cron and the manual
// "Jadwalkan Sekarang" button, so this is the single place the same-day
// guard lives.
//
// The guard exists because of a real incident: a test loop called the old
// (unguarded) build endpoint twice in a row and double-claimed 18 videos,
// 12 of them already overdue, before it was caught and manually undone.
//
// The guard CLAIMS the day up front with a conditional UPDATE rather than
// reading lastBuiltDate and writing it at the end. The read-then-write version
// left a window where the daily cron and the manual "Jadwalkan & Post
// Sekarang" button could both pass the check and both claim a set of videos --
// claimNextVideos() stops them getting the SAME video, but not a second set.
//
// Deliberate trade-off: if the build throws after the claim, the day counts as
// built and its slots are lost. That is the right direction (a lost day is
// cheaper than duplicate posts on nine real social accounts), and since the
// cron now isolates each account the failure shows up in the run summary
// instead of vanishing.
export async function buildScheduleForAccount(account: SchedulerAccount, todayISO: string): Promise<BuildResult> {
  // An account with no channel ID on ANY platform can't post anywhere, so
  // building it a queue only destroys videos: the row would be inserted with
  // platforms=[], dispatch would find zero outcomes and mark it "posted"
  // without contacting anyone, and the claimed video would sit at
  // status='scheduled' forever -- out of the pool (claimNextVideos only takes
  // 'uploaded'), never trashed, unrecoverable without manual SQL. Bail out
  // BEFORE claiming anything, and say so loudly enough that the admin fixes
  // the account instead of wondering where a video went each day.
  const platforms = resolveConfiguredPlatforms(account);
  if (platforms.length === 0) {
    return { status: "no_platforms" };
  }

  // Claim the day. No row back means another caller got here first, so this
  // one must not claim videos. rotationDayIndex rides along purely as a
  // "successful builds so far" counter now -- the slot times are derived from
  // the calendar date, not from it (see computeSlotTimes).
  const [claimedDay] = await db
    .update(schedulerAccounts)
    .set({ rotationDayIndex: account.rotationDayIndex + 1, lastBuiltDate: todayISO })
    .where(
      and(
        eq(schedulerAccounts.id, account.id),
        or(isNull(schedulerAccounts.lastBuiltDate), ne(schedulerAccounts.lastBuiltDate, todayISO)),
      ),
    )
    .returning({ id: schedulerAccounts.id });
  if (!claimedDay) {
    return { status: "already_built" };
  }

  // Rotate first, ramp second. The drift window is derived from the latest of
  // ALL baseTimes, so slicing the RESULT keeps the window identical across
  // every ramp phase regardless of how the admin ordered the array. (Slicing
  // the INPUT instead -- which this used to do -- made the window depend on
  // whichever times happened to be live today: reordering base_times so the
  // latest one isn't first turned a 10-minute window into a 460-minute one
  // during phase 1, then snapped it back on day 30.) The offset is uniform
  // across all base times, so slicing after is otherwise identical.
  const allowed = activeSlotCount(account, new Date());
  const slotTimes = computeSlotTimes(account.baseTimes, account.capTime, `${account.id}:${todayISO}`).slice(0, allowed);
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

  return { status: "built", slotsBuilt: built, slotsSkipped: slotTimes.length - built, slotsAllowed: allowed };
}
