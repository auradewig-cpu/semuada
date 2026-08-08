import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { buildScheduleForAccount, todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";

// Runs once/day (Vercel Cron, native support for daily cadence works fine on
// Hobby). Same-day guard lives in buildScheduleForAccount() -- see that file
// for why (a real double-build incident during this feature's own testing).
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const today = todayISOInTimezone(TIMEZONE);

  const summary: Array<{ account: string; result: Awaited<ReturnType<typeof buildScheduleForAccount>> }> = [];
  for (const account of accounts) {
    const result = await buildScheduleForAccount(account, today);
    summary.push({ account: account.label, result });
  }

  return NextResponse.json({ ok: true, date: today, accounts: summary });
}
