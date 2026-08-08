import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { buildScheduleForAccount, todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";
import { dispatchScheduledPost } from "@root/lib/scheduler/dispatch";

// Runs once/day (Vercel Cron, 01:00 WIB -- see vercel.ts), well before the
// earliest configured base time. Same-day guard lives in
// buildScheduleForAccount() -- see that file for why (a real double-build
// incident during this feature's own testing).
//
// After building each account's queue, every freshly-queued post is handed
// to Buffer/Zernio IMMEDIATELY with that provider's own "schedule for later"
// option (scheduledAt = the post's own slot time, e.g. 06:00) -- so the
// precise publish moment is Buffer/Zernio's responsibility, not this cron's.
// This replaces relying on the separate dispatch-posts GitHub Actions poller
// to fire at exactly the right minute (it drifts under load, see
// .github/workflows/dispatch-scheduler.yml) -- that poller still runs as a
// safety net for any row that somehow stays "queued" past its time (e.g. this
// step failing mid-way), just publishing it immediately at that point rather
// than scheduling it.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const today = todayISOInTimezone(TIMEZONE);

  const summary: Array<{ account: string; result: Awaited<ReturnType<typeof buildScheduleForAccount>>; dispatched: number }> = [];
  for (const account of accounts) {
    const result = await buildScheduleForAccount(account, today);

    const queued = await db
      .select()
      .from(scheduledPosts)
      .where(and(eq(scheduledPosts.schedulerAccountId, account.id), eq(scheduledPosts.status, "queued")));

    // Sequential -- don't burst-call Buffer/Zernio concurrently.
    for (const post of queued) {
      await dispatchScheduledPost(post, { scheduledAt: post.scheduledFor });
    }

    summary.push({ account: account.label, result, dispatched: queued.length });
  }

  return NextResponse.json({ ok: true, date: today, accounts: summary });
}
