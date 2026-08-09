import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { slugify } from "@/lib/utils";

// Mirrors GET /api/categories' grouping logic. Shared by app/layout.tsx
// (global CategoryProvider prefetch) and the [category]/[subcategory] pages
// (resolving the URL slug back to the real category/subcategory name for
// their own server-side product prefetch).
export async function getCategoryHierarchy(): Promise<Record<string, string[]>> {
  const rows = await db.select({ category: products.category, subcategory: products.subcategory }).from(products);
  const hierarchy: Record<string, string[]> = {};
  const seen: Record<string, Set<string>> = {};
  for (const row of rows) {
    if (!row.category) continue;
    if (!seen[row.category]) {
      seen[row.category] = new Set();
      hierarchy[row.category] = [];
    }
    if (row.subcategory && !seen[row.category].has(row.subcategory)) {
      seen[row.category].add(row.subcategory);
      hierarchy[row.category].push(row.subcategory);
    }
  }
  return hierarchy;
}

// Mirrors CategoryContext.tsx's categorySlugMap/subcategorySlugMap
// construction -- kept in sync manually since one runs on the server
// (resolving a URL param before the client mounts) and the other on the
// client (resolving nav clicks), but both must agree on which slug maps to
// which real category/subcategory name. Returns undefined for an unmatched
// slug, same as CategoryContext's Map.get() would -- callers then fall back
// to the unfiltered ("Semua Produk") view, matching existing client behavior.
export function resolveCategorySlug(
  hierarchy: Record<string, string[]>,
  categorySlug?: string,
  subcategorySlug?: string
): { category?: string; subcategory?: string } {
  const category = categorySlug
    ? Object.keys(hierarchy).find((name) => slugify(name) === categorySlug)
    : undefined;

  const subcategory = subcategorySlug
    ? Object.values(hierarchy)
        .flat()
        .find((name) => slugify(name) === subcategorySlug)
    : undefined;

  return { category, subcategory };
}
