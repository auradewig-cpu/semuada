import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";
import { toApiSchedulerAccount } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";
import { schedulerAccountRequestSchema, formatZodError } from "@root/lib/scheduler/validation";
import { MAX_SLOT_LANES } from "@root/lib/scheduler/rotation";

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
    posts_per_day,
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
  // Channel IDs follow the SAME rule. They used to use `?? null`, i.e. absent
  // meant "wipe it" -- harmless only because the dialog happens to send all
  // five every time. That is exactly the assumption that made the API-key wipe
  // possible, and it is not worth relying on twice: a partial body from any
  // other caller would silently unconfigure the account's platforms, and the
  // build would then skip it as unconfigured.
  const keyUpdate = (value: string | null | undefined) =>
    value === undefined ? undefined : value?.trim() || null;

  const values = {
    label,
    category,
    tiktokAccountId: keyUpdate(tiktok_account_id),
    instagramAccountId: keyUpdate(instagram_account_id),
    youtubeAccountId: keyUpdate(youtube_account_id),
    threadsAccountId: keyUpdate(threads_account_id),
    facebookPageAccountId: keyUpdate(facebook_page_account_id),
    // baseTimes / capTime / incrementMinutes are deliberately not written:
    // posting times are allocated automatically now (lib/scheduler/rotation.ts).
    // The columns keep their existing values as history.
    postsPerDay: posts_per_day,
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

  // The new account's permanent lane in the daily time allocation: the lowest
  // one nobody holds. Lanes are what keep two accounts from ever posting
  // within 5 minutes of each other (see lib/scheduler/rotation.ts), so there
  // are exactly MAX_SLOT_LANES of them. The UNIQUE constraint backs this up
  // if two inserts ever race -- the loser gets an error rather than a shared
  // lane.
  const taken = new Set(
    (await db.select({ slotLane: schedulerAccounts.slotLane }).from(schedulerAccounts)).map((r) => r.slotLane)
  );
  const slotLane = Array.from({ length: MAX_SLOT_LANES }, (_, i) => i).find((lane) => !taken.has(lane));
  if (slotLane === undefined) {
    return NextResponse.json(
      { error: `Sudah ada ${MAX_SLOT_LANES} akun -- batas maksimal agar jam posting antar-akun tidak bertabrakan.` },
      { status: 400 }
    );
  }

  // A new account starts its own warm-up from now: one post a day, stepping
  // up every RAMP_PHASE_DAYS until it reaches posts_per_day. Without this the
  // column defaults to null, postsAllowedToday() skips the warm-up, and a
  // brand-new account would begin at full cadence -- exactly the pattern the
  // ramp exists to avoid, and the case that matters most since a fresh
  // account is the one most likely to be flagged.
  // On insert there is nothing to preserve, so an absent field is a genuine
  // "not set yet" -- hence the `?? null` here but not above.
  const [row] = await db
    .insert(schedulerAccounts)
    .values({
      ...values,
      slotLane,
      tiktokAccountId: values.tiktokAccountId ?? null,
      instagramAccountId: values.instagramAccountId ?? null,
      youtubeAccountId: values.youtubeAccountId ?? null,
      threadsAccountId: values.threadsAccountId ?? null,
      facebookPageAccountId: values.facebookPageAccountId ?? null,
      bufferApiKey: keyUpdate(buffer_api_key) ?? null,
      zernioApiKey: keyUpdate(zernio_api_key) ?? null,
      rampStartedAt: new Date(),
    })
    .returning();
  return NextResponse.json(toApiSchedulerAccount(row), { status: 201 });
}
