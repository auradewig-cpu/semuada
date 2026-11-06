import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { postMetrics } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { syncPostMetrics } from "@root/lib/scheduler/metrics";

// Triggered by .github/workflows/dispatch-scheduler.yml, not Vercel Cron --
// the Hobby plan caps native crons at once per day and the two slots are
// already taken by build-schedule and purge-trash.
//
// A few times a day is deliberate rather than frequent: Buffer re-ingests
// its numbers only once every 24h, so polling harder cannot surface fresher
// data for TikTok/Instagram/YouTube. Zernio updates continuously, but this
// data drives day-scale trends, not live counters.
//
// The cadence is decided HERE, not in the workflow. The workflow used to call
// this only when its run happened to land in UTC hour 00, 08 or 16 -- but
// GitHub's `schedule` trigger meant to fire every 10 minutes actually fires
// every 4-7 hours, so whether a run hit one of those hours was luck, and from
// 2026-11-04 16:32 UTC it stopped hitting them at all: no metrics for days.
// Now the workflow calls on every run and this route skips unless the newest
// snapshot is at least MIN_INTERVAL_HOURS old -- about 4 syncs a day at
// GitHub's current pace, and still sane if it ever goes back to every 10
// minutes. `?force=1` (manual workflow_dispatch) bypasses the gate.
//
// Generous duration budget for the same reason build-schedule has one -- a
// mid-flight timeout here is harmless (the next run refills the day's row),
// but there's no reason to risk truncating a run.
export const maxDuration = 300;

const MIN_INTERVAL_HOURS = 3;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    // captured_at is refreshed on every upsert (see syncPostMetrics), so its
    // maximum is the time of the last sync that actually wrote something. A
    // sync that wrote nothing leaves it behind, which is the right outcome:
    // the next run tries again instead of waiting out the interval.
    const [latest] = await db.select({ at: sql<string | Date | null>`max(${postMetrics.capturedAt})` }).from(postMetrics);
    const lastSyncAt = latest?.at ? new Date(latest.at) : null;
    if (lastSyncAt && Date.now() - lastSyncAt.getTime() < MIN_INTERVAL_HOURS * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, lastSyncAt: lastSyncAt.toISOString() });
    }
  }

  const result = await syncPostMetrics();
  return NextResponse.json({ ok: true, ...result });
}
