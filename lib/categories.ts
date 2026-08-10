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

// generateStaticParams() feeds for the two category routes. Without these,
// `export const revalidate = 60` on a dynamic segment does NOTHING -- Next
// marks the route `ƒ Dynamic` and serves it with
// `Cache-Control: private, no-cache, no-store`, i.e. a full server render
// (measured 94-287ms) on every single category click. With them the routes
// become `● SSG`/ISR (`s-maxage=60`, `x-nextjs-cache: HIT`, ~4ms).
// dynamicParams stays at its default `true`, so categories added after a
// build still work -- they're rendered on demand and cached from then on.
export async function getCategoryParams(): Promise<{ category: string }[]> {
  const hierarchy = await getCategoryHierarchy();
  return Object.keys(hierarchy).map((name) => ({ category: slugify(name) }));
}

export async function getSubcategoryParams(): Promise<{ category: string; subcategory: string }[]> {
  const hierarchy = await getCategoryHierarchy();
  return Object.entries(hierarchy).flatMap(([category, subcategories]) =>
    subcategories.map((subcategory) => ({
      category: slugify(category),
      subcategory: slugify(subcategory),
    }))
  );
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
