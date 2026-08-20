import { cache } from "react";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export interface FilterOption {
  value: string;
  count: number;
}

// Distinct "dikirim dari" locations with their product counts, scoped to a
// category/subcategory, ordered by count desc.
//
// Shared by GET /api/options/dikirim-dari and by the category pages, which
// prefetch it into the ["locationOptions", category, subcategory] query so the
// filter panel has its options without a client round-trip. The desktop filter
// sidebar is `hidden lg:block` -- still MOUNTED on mobile -- so its query fired
// on every category page view even though nobody could see the panel; feeding
// it from the server sidesteps that on every device.
//
// ::int matters: count(*) is bigint, which the Neon driver returns as a string.
export const getLocationOptions = cache(
  async (category?: string, subcategory?: string): Promise<FilterOption[]> => {
    const conditions = [isNotNull(products.dikirim_dari), ne(products.dikirim_dari, "")];
    if (category) conditions.push(eq(products.category, category));
    if (subcategory) conditions.push(eq(products.subcategory, subcategory));

    const rows = await db
      .select({ value: products.dikirim_dari, count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...conditions))
      .groupBy(products.dikirim_dari)
      .orderBy(sql`count(*) desc`);

    return rows
      .filter((row) => row.value)
      .map((row) => ({ value: row.value as string, count: row.count }));
  }
);
