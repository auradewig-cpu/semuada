import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { buildScheduleForAccount, todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";
import { claimQueuedPostsForAccount, dispatchScheduledPost } from "@root/lib/scheduler/dispatch";

// Admin-triggered ("Jadwalkan & Post Sekarang" button), not cron -- uses the
// normal session auth (requireAuth), not the cron bearer-secret.
//
// Builds today's queue (safe to click repeatedly: buildScheduleForAccount()'s
// same-day guard makes a second build a no-op instead of double-claiming
// videos) and then IMMEDIATELY dispatches every still-queued post for this
// account -- calling Buffer/Zernio for real right away, rather than waiting
// for the next GitHub Actions poll (see .github/workflows/dispatch-scheduler.yml).
// This is a deliberate one-click "schedule and publish now" action per the
// user's explicit request, not a preview/dry-run -- it has real,
// immediately-visible effects on the connected social accounts.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, id));
  if (!account) {
    return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
  }

  const today = todayISOInTimezone(TIMEZONE);
  const buildResult = await buildScheduleForAccount(account, today);

  // Dispatch every currently-queued post for this account, not just ones
  // freshly built above -- if a previous build already ran today but some
  // slots weren't picked up by GitHub Actions yet, this button still posts
  // them immediately instead of doing nothing.
  // Claimed, not selected -- otherwise clicking this while the 01:00 cron or
  // the 10-minute poller is mid-run would dispatch the same row twice.
  const queued = await claimQueuedPostsForAccount(id);

  // Sequential, same reasoning as dispatch-posts cron: don't burst-call
  // Buffer/Zernio concurrently.
  let posted = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const post of queued) {
    await dispatchScheduledPost(post);
    const [updated] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, post.id));
    if (updated?.status === "posted") posted++;
    else {
      failed++;
      if (updated?.errorMessage) errors.push(updated.errorMessage);
    }
  }

  return NextResponse.json({ ok: true, date: today, buildResult, dispatch: { attempted: queued.length, posted, failed, errors } });
}
