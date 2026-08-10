import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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
// Generous duration budget for the same reason build-schedule has one -- a
// mid-flight timeout here is harmless (the next run refills the day's row),
// but there's no reason to risk truncating a run.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const result = await syncPostMetrics();
  return NextResponse.json({ ok: true, ...result });
}
