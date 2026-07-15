import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const subcategory = params.get("subcategory") ?? undefined;

  const conditions = [isNotNull(products.item), ne(products.item, "")];
  if (category) conditions.push(eq(products.category, category));
  if (subcategory) conditions.push(eq(products.subcategory, subcategory));

  const rows = await db
    .select({ item: products.item })
    .from(products)
    .where(and(...conditions));

  const values = Array.from(new Set(rows.map((r) => r.item).filter(Boolean) as string[])).sort();
  return NextResponse.json(values);
}
