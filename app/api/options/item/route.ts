import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export interface ItemOption {
  value: string;
  count: number;
}

// GET /api/options/item?category=&subcategory=
// Returns distinct items as {value, count} ordered by count desc, scoped to the
// category/subcategory when given. Aggregated in SQL (previously it pulled
// every matching row and dedup'd in JS). FilterSidebar (now removed) was the
// only "live" consumer; the admin ProductPicker derives its Select options from
// the same hook and was updated to read `.value`.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const subcategory = params.get("subcategory") ?? undefined;

  const conditions = [isNotNull(products.item), ne(products.item, "")];
  if (category) conditions.push(eq(products.category, category));
  if (subcategory) conditions.push(eq(products.subcategory, subcategory));

  const rows = await db
    // ::int -- see the same cast in /api/options/dikirim-dari: bigint comes
    // back from the Neon driver as a string.
    .select({ value: products.item, count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...conditions))
    .groupBy(products.item)
    .orderBy(sql`count(*) desc`);

  const items: ItemOption[] = rows
    .filter((r) => r.value)
    .map((r) => ({ value: r.value as string, count: r.count }));

  return NextResponse.json(items);
}
