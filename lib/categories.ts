import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { slugify } from "@/lib/utils";

export interface CategorySubcategory {
  name: string;
  slug: string;
  productCount: number;
}

export interface CategoryEntry {
  name: string;
  slug: string;
  productCount: number;
  subcategories: CategorySubcategory[];
}

// One grouped query produces everything category-related: the category grid
// (name + count), the chips row (subcategory names + counts), and the
// hierarchy map (see getCategoryHierarchy below). Previously each consumer ran
// its own query; this single SELECT replaces them and carries the counts the
// "Semua Kategori" grid and the chips need.
//
// select category, subcategory, count(*) group by 1,2 -- sorted by total
// productCount desc then name asc. cache(): layout.tsx, both category pages,
// and app/page.tsx all call this on the same request, so without it every
// render paid for the query several times.
export const getCategoryCatalog = cache(async (): Promise<CategoryEntry[]> => {
  const rows = await db
    .select({
      category: products.category,
      subcategory: products.subcategory,
      // ::int is NOT decoration -- Postgres count(*) is bigint, which the Neon
      // driver hands back as a STRING. Without the cast, `productCount += count`
      // below concatenates instead of adding (0 + "8" + "2" + "10" -> "08210"),
      // which broke both the counts rendered in CategoryGrid and the
      // order-by-popularity sort this whole query exists for.
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(sql`${products.category} is not null`)
    .groupBy(products.category, products.subcategory);

  // Aggregate rows into per-category entries, carrying per-subcategory counts.
  const byCategory = new Map<string, CategoryEntry>();
  const subCounts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.category) continue;
    if (!byCategory.has(row.category)) {
      byCategory.set(row.category, { name: row.category, slug: slugify(row.category), productCount: 0, subcategories: [] });
      subCounts.set(row.category, new Map());
    }
    const entry = byCategory.get(row.category)!;
    entry.productCount += row.count;
    if (row.subcategory) {
      subCounts.get(row.category)!.set(row.subcategory, (subCounts.get(row.category)!.get(row.subcategory) ?? 0) + row.count);
    }
  }

  const entries = Array.from(byCategory.values());
  for (const entry of entries) {
    entry.subcategories = Array.from(subCounts.get(entry.name)!.entries())
      .map(([name, productCount]) => ({ name, slug: slugify(name), productCount }))
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
  }
  entries.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

  return entries;
});

// The category tree, backing GET /api/categories, app/layout.tsx's global
// CategoryProvider prefetch, and the [category]/[subcategory] pages (which
// resolve the URL slug back to the real category/subcategory name for their
// own server-side product prefetch). Derived from getCategoryCatalog() so there
// is still exactly one query per request -- the shape (Record<string, string[]>)
// is unchanged, so /api/categories, app/layout.tsx, and CategoryContext's
// hydration key ["categoryHierarchy"] are untouched.
export const getCategoryHierarchy = cache(async (): Promise<Record<string, string[]>> => {
  const catalog = await getCategoryCatalog();
  const hierarchy: Record<string, string[]> = {};
  for (const entry of catalog) {
    hierarchy[entry.name] = entry.subcategories.map((s) => s.name);
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
