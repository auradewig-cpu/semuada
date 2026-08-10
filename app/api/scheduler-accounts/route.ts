import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";
import { toApiSchedulerAccount } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";
import { schedulerAccountRequestSchema, formatZodError } from "@root/lib/scheduler/validation";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(schedulerAccounts).orderBy(asc(schedulerAccounts.label));
  return NextResponse.json({ items: rows.map(toApiSchedulerAccount) });
}

// `id` present -> edit existing row. Absent -> insert new. Unlike
// videoStorageAccounts (upsert by unique category), label/category aren't
// unique here -- multiple accounts can legitimately share a category (see
// claimNextVideos() in lib/scheduler/videoPool.ts for how that's kept
// race-safe), so there's no natural conflict target to upsert on.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const parsed = schedulerAccountRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const {
    id,
    label,
    category,
    buffer_api_key,
    zernio_api_key,
    tiktok_account_id,
    instagram_account_id,
    youtube_account_id,
    threads_account_id,
    facebook_page_account_id,
    base_times,
    increment_minutes,
    cap_time,
    is_active,
  } = parsed.data;

  const values = {
    label,
    category,
    bufferApiKey: buffer_api_key ?? null,
    zernioApiKey: zernio_api_key ?? null,
    tiktokAccountId: tiktok_account_id ?? null,
    instagramAccountId: instagram_account_id ?? null,
    youtubeAccountId: youtube_account_id ?? null,
    threadsAccountId: threads_account_id ?? null,
    facebookPageAccountId: facebook_page_account_id ?? null,
    baseTimes: base_times,
    incrementMinutes: increment_minutes,
    capTime: cap_time,
    isActive: is_active,
    updatedAt: new Date(),
  };

  if (id) {
    // rampStartedAt is deliberately absent from `values`, so editing an
    // account never restarts (or silently clears) its warm-up.
    const [row] = await db.update(schedulerAccounts).set(values).where(eq(schedulerAccounts.id, id)).returning();
    if (!row) {
      return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json(toApiSchedulerAccount(row));
  }

  // A new account starts its own frequency ramp from now: one post a day,
  // stepping up every RAMP_PHASE_DAYS. Without this the column defaults to
  // null, activeSlotCount() falls back to "use every baseTime", and a
  // brand-new account would begin at full cadence -- exactly the pattern the
  // ramp exists to avoid, and the case that matters most since a fresh
  // account is the one most likely to be flagged.
  const [row] = await db.insert(schedulerAccounts).values({ ...values, rampStartedAt: new Date() }).returning();
  return NextResponse.json(toApiSchedulerAccount(row), { status: 201 });
}
