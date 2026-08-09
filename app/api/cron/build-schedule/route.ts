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
//
// Explicit timeout budget + parallel dispatch: this is the direct fix for a
// real duplicate-post incident (2026-08-09). The old sequential loop (one
// dispatchScheduledPost() awaited at a time -- each involving a full Zernio
// video re-upload plus 3 sequential Buffer calls) could add up to minutes of
// wall-clock time across a full day's batch, with no maxDuration override to
// match. When the function got killed by the platform's default timeout
// mid-flight, a provider could have already ACCEPTED a post (e.g. mid-way
// through Buffer's tiktok->instagram->youtube loop) with zero chance for our
// trailing db.update() to ever record it -- leaving the row stuck at
// "queued" even though it had really been posted. Hours later the
// dispatch-posts safety net found it still "queued" past its time and
// dispatched it AGAIN (immediate mode), creating a real second post.
// Parallelizing is safe here (unlike dispatch-posts' intentionally-sequential
// backlog-draining loop): each post is an independent row/video/account, this
// batch is small and bounded (one day's slots, not an unbounded overdue
// backlog), and different accounts already use different provider API keys.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const today = todayISOInTimezone(TIMEZONE);

  const summary = await Promise.all(
    accounts.map(async (account) => {
      const result = await buildScheduleForAccount(account, today);

      const queued = await db
        .select()
        .from(scheduledPosts)
        .where(and(eq(scheduledPosts.schedulerAccountId, account.id), eq(scheduledPosts.status, "queued")));

      await Promise.all(queued.map((post) => dispatchScheduledPost(post, { scheduledAt: post.scheduledFor })));

      return { account: account.label, result, dispatched: queued.length };
    }),
  );

  return NextResponse.json({ ok: true, date: today, accounts: summary });
}
