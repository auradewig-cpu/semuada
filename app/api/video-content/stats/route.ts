import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const rows = await db
    .select({ category: videoContents.category, count: count() })
    .from(videoContents)
    .groupBy(videoContents.category);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return NextResponse.json({
    total,
    byCategory: rows.map((r) => ({ category: r.category, count: r.count })).sort((a, b) => b.count - a.count),
  });
}
