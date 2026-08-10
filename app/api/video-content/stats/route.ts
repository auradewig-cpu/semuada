import { NextResponse } from "next/server";
import { count, isNull } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  // Excludes purged tombstones for the same reason the library listing does
  // -- they're retained only to keep scheduled_posts' FK valid, and counting
  // them would inflate this indicator with videos that no longer exist.
  const rows = await db
    .select({ category: videoContents.category, count: count() })
    .from(videoContents)
    .where(isNull(videoContents.purgedAt))
    .groupBy(videoContents.category);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return NextResponse.json({
    total,
    byCategory: rows.map((r) => ({ category: r.category, count: r.count })).sort((a, b) => b.count - a.count),
  });
}
