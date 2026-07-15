import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, productAnalytics } from "@shared/schema";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // neon-http has no interactive transaction support; db.batch() sends both
  // statements as a single atomic request instead.
  await db.batch([
    db.insert(productAnalytics).values({ productId: id, eventType: "click" }),
    db
      .update(products)
      .set({ clicks: sql`${products.clicks} + 1` })
      .where(eq(products.id, id)),
  ]);

  return NextResponse.json({ ok: true });
}
