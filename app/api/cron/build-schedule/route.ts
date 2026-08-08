import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { computeSlotTimes, slotTimeToDate } from "@root/lib/scheduler/rotation";
import { claimNextVideos } from "@root/lib/scheduler/videoPool";
import { resolveConfiguredPlatforms } from "@root/lib/scheduler/platforms";

// All accounts currently target an Indonesian audience -- fixed rather than
// a per-account column to avoid UI complexity nobody has asked for. Add a
// timezone column if a genuinely different-timezone account shows up later.
const TIMEZONE = "Asia/Jakarta";

function todayISOInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Runs once/day (Vercel Cron, native support for daily cadence works fine on
// Hobby). For each active account: compute today's rotated slot times,
// claim that many videos from its category's pool in one shot, and queue a
// scheduled_posts row per slot that got a video. Slots beyond however many
// videos were available are simply left unqueued -- the shortfall is visible
// to the admin as "today's queued count < base_times.length" in the UI
// rather than a dedicated warning column.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const today = todayISOInTimezone(TIMEZONE);

  const summary: Array<{ account: string; slotsBuilt: number; slotsSkipped: number }> = [];

  for (const account of accounts) {
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
        scheduledFor: slotTimeToDate(today, slotTimes[i], TIMEZONE),
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
      .set({ rotationDayIndex: account.rotationDayIndex + 1 })
      .where(eq(schedulerAccounts.id, account.id));

    summary.push({ account: account.label, slotsBuilt: built, slotsSkipped: slotTimes.length - built });
  }

  return NextResponse.json({ ok: true, date: today, accounts: summary });
}
