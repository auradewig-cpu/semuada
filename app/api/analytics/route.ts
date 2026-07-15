import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, productAnalytics } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

type Period = "1d" | "7d" | "30d" | "all";

function getStartDate(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "1d":
      now.setDate(now.getDate() - 1);
      return now;
    case "7d":
      now.setDate(now.getDate() - 7);
      return now;
    case "30d":
      now.setDate(now.getDate() - 30);
      return now;
    case "all":
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const period = (request.nextUrl.searchParams.get("period") as Period) ?? "all";
  const startDate = getStartDate(period);

  const [totalProductsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(startDate ? gte(products.createdAt, startDate) : undefined);

  const [totalClicksRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productAnalytics)
    .where(
      startDate
        ? and(eq(productAnalytics.eventType, "click"), gte(productAnalytics.createdAt, startDate))
        : eq(productAnalytics.eventType, "click"),
    );

  const topProducts = await db
    .select({
      product_id: productAnalytics.productId,
      product_name: products.productName,
      click_count: sql<number>`count(*)::int`,
    })
    .from(productAnalytics)
    .innerJoin(products, sql`${products.id}::text = ${productAnalytics.productId}`)
    .where(
      startDate
        ? and(eq(productAnalytics.eventType, "click"), gte(productAnalytics.createdAt, startDate))
        : eq(productAnalytics.eventType, "click"),
    )
    .groupBy(productAnalytics.productId, products.productName)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return NextResponse.json({
    totalProducts: totalProductsRow?.count ?? 0,
    totalClicks: totalClicksRow?.count ?? 0,
    topProducts,
  });
}
