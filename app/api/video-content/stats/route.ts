import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { postsAllowedToday } from "@root/lib/scheduler/rotation";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  // Two numbers per category out of ONE grouped query.
  //
  // `available` excludes trashed videos because this indicator is read as
  // remaining STOCK -- it is the only place in the app that shows how much
  // video is left per category, and it drives the decision of which category
  // needs more production. Counting videos the scheduler has already posted
  // (they get trashedAt set, see lib/scheduler/dispatch.ts) overstated it
  // badly: 91 shown against 43 actually left.
  //
  // `trashed` is returned rather than dropped because the library's trash view
  // switches every number on screen over to it -- title, category chips and
  // the trash button all describe whichever set is currently displayed.
  //
  // Purged tombstones are excluded from both: they're retained only to keep
  // scheduled_posts' FK valid and no longer exist as videos.
  //
  // The ::int casts are load-bearing. Postgres count(*) is bigint, which the
  // Neon driver hands back as a STRING -- without the cast the reduce below
  // concatenates instead of adding (0 + "43" + "58" -> "04358"). Same trap as
  // the one documented in lib/categories.ts.
  const rows = await db
    .select({
      category: videoContents.category,
      available: sql<number>`count(*) filter (where ${videoContents.trashedAt} is null)::int`,
      trashed: sql<number>`count(*) filter (where ${videoContents.trashedAt} is not null)::int`,
    })
    .from(videoContents)
    .where(isNull(videoContents.purgedAt))
    .groupBy(videoContents.category);

  const total = rows.reduce((sum, r) => sum + r.available, 0);
  const trashedTotal = rows.reduce((sum, r) => sum + r.trashed, 0);

  // Per-lane stock. Without this the lane feature is unusable in practice: a
  // lane running dry is invisible until the account simply stops posting, and
  // the "video kurang" warning in SchedulerTab only fires on the day it has
  // already happened. This is the number that tells you to produce more.
  //
  // Every active account appears, including ones with an empty lane (a LEFT
  // JOIN from accounts, not a GROUP BY over videos) -- an account with zero
  // reserved videos is exactly the one worth seeing.
  //
  // days_left turns the count into the question it is actually asked to
  // answer -- "when does this run out?" -- at the rate the account really
  // posts today (posts_per_day held back by any warm-up, the same rule the
  // build uses). At 5 posts a day a lane of 18 is under four days, which a
  // bare "18" does not convey.
  const now = new Date();
  const laneRows = await db
    .select({
      scheduler_account_id: schedulerAccounts.id,
      label: schedulerAccounts.label,
      category: schedulerAccounts.category,
      postsPerDay: schedulerAccounts.postsPerDay,
      rampStartedAt: schedulerAccounts.rampStartedAt,
      available: sql<number>`count(${videoContents.id}) filter (where ${videoContents.trashedAt} is null and ${videoContents.purgedAt} is null and ${videoContents.status} = 'uploaded')::int`,
    })
    .from(schedulerAccounts)
    .leftJoin(videoContents, eq(videoContents.schedulerAccountId, schedulerAccounts.id))
    .where(eq(schedulerAccounts.isActive, true))
    .groupBy(
      schedulerAccounts.id,
      schedulerAccounts.label,
      schedulerAccounts.category,
      schedulerAccounts.postsPerDay,
      schedulerAccounts.rampStartedAt
    )
    .orderBy(schedulerAccounts.category, schedulerAccounts.label);
  const lanes = laneRows.map(({ postsPerDay, rampStartedAt, ...lane }) => {
    // Always >= 1, so the division is safe.
    const posts_today = postsAllowedToday({ postsPerDay, rampStartedAt }, now);
    return { ...lane, posts_today, days_left: Math.floor(lane.available / posts_today) };
  });

  // What is still up for grabs by any account in the category.
  const sharedPool = await db
    .select({
      category: videoContents.category,
      available: sql<number>`count(*)::int`,
    })
    .from(videoContents)
    .where(
      and(
        isNull(videoContents.schedulerAccountId),
        isNull(videoContents.trashedAt),
        isNull(videoContents.purgedAt),
        eq(videoContents.status, "uploaded")
      )
    )
    .groupBy(videoContents.category);

  // Days of stock per category: everything still postable in it (every
  // active account's lane plus the shared pool) over what its active accounts
  // post per day between them. An estimate -- it treats the category's stock
  // as one pot, while a lane only feeds its own account -- but it is the
  // number that says which category needs production next. null where no
  // active account posts from the category.
  const dailyNeed = new Map<string, number>();
  const postable = new Map<string, number>();
  for (const lane of lanes) {
    dailyNeed.set(lane.category, (dailyNeed.get(lane.category) ?? 0) + lane.posts_today);
    postable.set(lane.category, (postable.get(lane.category) ?? 0) + lane.available);
  }
  for (const pool of sharedPool) postable.set(pool.category, (postable.get(pool.category) ?? 0) + pool.available);
  const daysLeft = (category: string) => {
    const need = dailyNeed.get(category);
    return need ? Math.floor((postable.get(category) ?? 0) / need) : null;
  };

  return NextResponse.json({
    total,
    trashedTotal,
    lanes,
    sharedPool,
    // Ordered by available stock, never re-sorted for the trash view, so chip
    // positions stay put when that view is toggled. The name tie-break keeps
    // equal counts (soon common, since empty categories now show 0) from
    // swapping places between refetches.
    byCategory: rows
      .map((r) => ({ category: r.category, available: r.available, trashed: r.trashed, days_left: daysLeft(r.category) }))
      .sort((a, b) => b.available - a.available || a.category.localeCompare(b.category)),
  });
}
