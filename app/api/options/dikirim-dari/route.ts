import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export interface LocationOption {
  value: string;
  count: number;
}

// GET /api/options/dikirim-dari?category=&subcategory=
// Returns distinct locations as {value, count}, ordered by count desc, scoped
// to the category/subcategory when given. This is the "Lokasi" filter (the
// shop's origin, not a delivery service). Aggregated in SQL rather than
// dedup'd in JS so a page view only pulls the grouped rows, and the count lets
// the filter surface only the locations that actually occur in this catalog.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const subcategory = params.get("subcategory") ?? undefined;

  const conditions = [isNotNull(products.dikirim_dari), ne(products.dikirim_dari, "")];
  if (category) conditions.push(eq(products.category, category));
  if (subcategory) conditions.push(eq(products.subcategory, subcategory));

  const rows = await db
    // ::int -- count(*) is bigint, which the Neon driver returns as a string
    // (so the `sql<number>` annotation would otherwise be a lie at runtime).
    .select({ value: products.dikirim_dari, count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...conditions))
    .groupBy(products.dikirim_dari)
    .orderBy(sql`count(*) desc`);

  const items: LocationOption[] = rows
    .filter((r) => r.value)
    .map((r) => ({ value: r.value as string, count: r.count }));

  return NextResponse.json(items);
}
