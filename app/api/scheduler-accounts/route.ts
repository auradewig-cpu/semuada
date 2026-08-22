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
    cap_time,
    is_active,
  } = parsed.data;

  // The dialog never sends an API key back on edit -- it blanks both password
  // fields on load, so an ordinary edit (renaming an account, pasting a
  // channel ID) arrives with these two fields ABSENT, meaning "keep the key
  // you already have". Mapping that absence to `null` is what silently wiped
  // both credentials on every save: Drizzle drops `undefined` from .set() but
  // writes `null`, so the update branch really did issue
  // `set buffer_api_key = null, zernio_api_key = null`, killing that account's
  // posting on all 5 platforms.
  //
  // Absent -> undefined (untouched). Explicit null or an empty string ->
  // null, so deliberately clearing a key is still possible; the two cases are
  // no longer conflated. The optional chaining is load-bearing: the schema
  // accepts an explicit null, and `null.trim()` would 500 the route.
  const keyUpdate = (value: string | null | undefined) =>
    value === undefined ? undefined : value?.trim() || null;

  const values = {
    label,
    category,
    tiktokAccountId: tiktok_account_id ?? null,
    instagramAccountId: instagram_account_id ?? null,
    youtubeAccountId: youtube_account_id ?? null,
    threadsAccountId: threads_account_id ?? null,
    facebookPageAccountId: facebook_page_account_id ?? null,
    baseTimes: base_times,
    // incrementMinutes is deliberately not written: the rotation no longer
    // uses it (see lib/scheduler/rotation.ts). The column keeps its existing
    // values so nothing is lost, it just stops driving anything.
    capTime: cap_time,
    isActive: is_active,
    updatedAt: new Date(),
  };

  if (id) {
    // rampStartedAt is deliberately absent from `values`, so editing an
    // account never restarts (or silently clears) its warm-up. The two keys
    // come in as undefined when left blank, which Drizzle drops from the
    // generated UPDATE entirely -- that is what makes "blank = keep" real
    // rather than just a comment.
    const [row] = await db
      .update(schedulerAccounts)
      .set({ ...values, bufferApiKey: keyUpdate(buffer_api_key), zernioApiKey: keyUpdate(zernio_api_key) })
      .where(eq(schedulerAccounts.id, id))
      .returning();
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
  // On insert there is no existing key to preserve, so an absent field is a
  // genuine "no credential yet" -- hence the `?? null` here but not above.
  const [row] = await db
    .insert(schedulerAccounts)
    .values({
      ...values,
      bufferApiKey: keyUpdate(buffer_api_key) ?? null,
      zernioApiKey: keyUpdate(zernio_api_key) ?? null,
      rampStartedAt: new Date(),
    })
    .returning();
  return NextResponse.json(toApiSchedulerAccount(row), { status: 201 });
}
