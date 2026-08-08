import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { buildScheduleForAccount, todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";

// Admin-triggered ("Jadwalkan Sekarang" button), not cron -- uses the normal
// session auth (requireAuth), not the cron bearer-secret. Safe to click
// repeatedly: buildScheduleForAccount()'s same-day guard makes a second call
// on the same day a no-op instead of double-claiming videos.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, id));
  if (!account) {
    return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
  }

  const today = todayISOInTimezone(TIMEZONE);
  const result = await buildScheduleForAccount(account, today);
  return NextResponse.json({ ok: true, date: today, result });
}
