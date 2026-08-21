import { NextResponse } from "next/server";
import { isNull, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

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

  return NextResponse.json({
    total,
    trashedTotal,
    // Ordered by available stock, never re-sorted for the trash view, so chip
    // positions stay put when that view is toggled. The name tie-break keeps
    // equal counts (soon common, since empty categories now show 0) from
    // swapping places between refetches.
    byCategory: rows
      .map((r) => ({ category: r.category, available: r.available, trashed: r.trashed }))
      .sort((a, b) => b.available - a.available || a.category.localeCompare(b.category)),
  });
}
