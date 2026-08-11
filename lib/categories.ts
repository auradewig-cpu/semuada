import { cache } from "react";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { slugify } from "@/lib/utils";

// The category tree, backing GET /api/categories, app/layout.tsx's global
// CategoryProvider prefetch, and the [category]/[subcategory] pages (which
// resolve the URL slug back to the real category/subcategory name for their
// own server-side product prefetch).
//
// selectDistinct: this used to pull every product row (1,097 rows / ~75 KB /
// ~130ms measured) just to derive 18 categories and 93 subcategories -- the
// grouping loop below was throwing away ~98% of what it fetched.
//
// cache(): layout.tsx and the page under it both call this on the same
// request, so without it every category render paid for the query twice.
export const getCategoryHierarchy = cache(async (): Promise<Record<string, string[]>> => {
  const rows = await db
    .selectDistinct({ category: products.category, subcategory: products.subcategory })
    .from(products);
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
});

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
// which real category/subcategory name.
//
// Returns undefined for an unmatched slug. Callers MUST treat that as a 404
// rather than falling through to the unfiltered view -- see the pages, and
// the note on notFound() there.
export function resolveCategorySlug(
  hierarchy: Record<string, string[]>,
  categorySlug?: string,
  subcategorySlug?: string
): { category?: string; subcategory?: string } {
  const category = categorySlug
    ? Object.keys(hierarchy).find((name) => slugify(name) === categorySlug)
    : undefined;

  // Scoped to the resolved category rather than searched across the whole
  // hierarchy: a subcategory belonging to a DIFFERENT category is not a valid
  // pair. 98 (category, subcategory) pairs share only 93 distinct subcategory
  // names, so the flat search really could match the wrong branch -- and
  // /pakaian-pria/perawatan-wajah resolved to a real-looking page with zero
  // products instead of a 404.
  const subcategory =
    subcategorySlug && category
      ? (hierarchy[category] ?? []).find((name) => slugify(name) === subcategorySlug)
      : undefined;

  return { category, subcategory };
}
