import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { buildScheduleForAccount, todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";
import { claimQueuedPostsForAccount, dispatchScheduledPost } from "@root/lib/scheduler/dispatch";

// How far ahead a slot must be for this button to still use it. Buffer and
// Zernio both need the due time to be in the future when they receive the
// post; a slot two minutes out would race the hand-off itself.
const HANDOFF_LEAD_MINUTES = 15;

// Admin-triggered ("Jadwalkan Sisa Hari Ini" button), not cron -- uses the
// normal session auth (requireAuth), not the cron bearer-secret.
//
// Builds what is LEFT of today's queue and hands every remaining slot to
// Buffer/Zernio for its own time, the same way the 01:00 cron does. It used
// to publish everything immediately; at five posts a day starting 07:00 that
// meant a click at 15:00 put four or five near-identical videos out on one
// account inside a minute -- the burst the posting-time allocation exists to
// prevent. Slots already past are skipped and their videos stay in stock
// (see `notBefore` in buildScheduleForAccount).
//
// Safe to click repeatedly: the same-day guard makes a second build a no-op,
// and posts are claimed rather than selected, so this can't race the 01:00
// cron or the dispatch-posts poller into handing the same row over twice.
// Normally this does nothing at all -- the cron has already built and handed
// off the day. It matters for an account created or re-activated mid-day, or
// after a failed nightly build.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, id));
  if (!account) {
    return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
  }

  const today = todayISOInTimezone(TIMEZONE);
  const notBefore = new Date(Date.now() + HANDOFF_LEAD_MINUTES * 60 * 1000);
  const buildResult = await buildScheduleForAccount(account, today, { notBefore });

  // Every still-queued post for this account whose slot is ahead -- not only
  // the ones built just now, so a day whose nightly hand-off failed is picked
  // up too. Overdue rows are left to the dispatch-posts safety net.
  const queued = await claimQueuedPostsForAccount(id, { dueAfter: notBefore });

  // Sequential, same reasoning as dispatch-posts cron: don't burst-call
  // Buffer/Zernio concurrently.
  let scheduled = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const post of queued) {
    await dispatchScheduledPost(post, { scheduledAt: post.scheduledFor });
    const [updated] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, post.id));
    if (updated?.status === "posted") scheduled++;
    else {
      failed++;
      if (updated?.errorMessage) errors.push(updated.errorMessage);
    }
  }

  return NextResponse.json({ ok: true, date: today, buildResult, dispatch: { attempted: queued.length, scheduled, failed, errors } });
}
