import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  return NextResponse.json(rows.map(toApiProduct));
}
