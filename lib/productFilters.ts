// The single source of truth for the shape of product filters -- shared by the
// server (app/**/page.tsx prefetch, GET /api/products) and the client
// (useInfiniteProducts, useCatalogFilters). Keep this file free of server-only
// imports so both sides can import it via @root/lib/productFilters.
//
// This is what useInfiniteProducts/useFeaturedProducts hash into their query
// keys. Historically the server wrote `{...DEFAULT_PRODUCT_FILTERS, category}`
// and Home.tsx wrote its own `useState<FilterState>` by hand -- two places that
// had to stay structurally identical (after JSON.stringify drops undefined
// keys), because a mismatch silently produced a double-fetch. buildInitialFilters()
// is the single factory both sides call now.

export type SortKey =
  | "newest"
  | "popular"
  | "terlaris"
  | "harga_termurah"
  | "harga_tertinggi"
  | "rekomendasi";

export interface ProductFilters {
  search: string;
  priceMin: number;
  priceMax: number;
  sortBy: SortKey;
  /** Minimum rating threshold. Values beyond 4.0 only (see RATING_OPTIONS). */
  ratingMin?: number;
  category?: string;
  subcategory?: string;
  dikirim_dari?: string;
  item?: string;
}

export const PRICE_MAX = 20_000_000;

// Shared default. Deliberately a function call so the returned object is fresh
// and never shared/mutated. Not `as const` -- it's typed as ProductFilters so
// the query key it feeds matches the client's buildInitialFilters() exactly.
export const DEFAULT_PRODUCT_FILTERS: ProductFilters = buildInitialFilters();

// MUST be used by the server pages (app/**/page.tsx) AND the client
// (useCatalogFilters) so the react-query key is identical on both sides. This
// is the factory that used to be written twice and caused the double-fetch.
export function buildInitialFilters(opts?: { category?: string; subcategory?: string }): ProductFilters {
  return {
    search: "",
    priceMin: 0,
    priceMax: PRICE_MAX,
    sortBy: "newest",
    ratingMin: undefined,
    category: opts?.category,
    subcategory: opts?.subcategory,
    dikirim_dari: undefined,
    item: undefined,
  };
}

// Price presets chosen from the real price distribution (median 297rb, p90
// 463rb) -- a 0-20jt slider puts 97% of products in the first four steps, so
// presets + manual min/max inputs replace it.
export const PRICE_PRESETS = [
  { label: "Di bawah Rp100rb", min: 0, max: 100_000 },
  { label: "Rp100rb – Rp300rb", min: 100_000, max: 300_000 },
  { label: "Rp300rb – Rp500rb", min: 300_000, max: 500_000 },
  { label: "Di atas Rp500rb", min: 500_000, max: PRICE_MAX },
];

// Rating distribution makes "4 stars and up" filter ~2% of products (≥4: 5,
// <4: 25, while ≥4.5: 1128). So the Shopee-style floor is useless here.
export const RATING_OPTIONS = [4.5, 4.8, 5.0];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rekomendasi", label: "Rekomendasi" },
  { value: "newest", label: "Terbaru" },
  { value: "terlaris", label: "Terlaris" },
  { value: "popular", label: "Populer" },
  { value: "harga_termurah", label: "Harga Termurah" },
  { value: "harga_tertinggi", label: "Harga Tertinggi" },
];

// URL query params are short + stable; do not rename after release.
export const URL_PARAM = {
  sort: "urut",
  priceMin: "hmin",
  priceMax: "hmax",
  rating: "rating",
  lokasi: "lokasi",
  item: "item",
  search: "q",
} as const;

// Only values that differ from the base/default are written, so a URL with no
// active filters stays a clean path with no `?`. category/subcategory are NOT
// serialized here -- they live in the path (/kategori/subkategori).
export function filtersToQuery(f: ProductFilters): URLSearchParams {
  const qs = new URLSearchParams();
  if (f.sortBy && f.sortBy !== "newest") qs.set(URL_PARAM.sort, f.sortBy);
  if (f.priceMin !== undefined && f.priceMin !== 0) qs.set(URL_PARAM.priceMin, String(f.priceMin));
  if (f.priceMax !== undefined && f.priceMax !== PRICE_MAX) qs.set(URL_PARAM.priceMax, String(f.priceMax));
  if (f.ratingMin !== undefined) qs.set(URL_PARAM.rating, String(f.ratingMin));
  if (f.dikirim_dari) qs.set(URL_PARAM.lokasi, f.dikirim_dari);
  if (f.item) qs.set(URL_PARAM.item, f.item);
  if (f.search) qs.set(URL_PARAM.search, f.search);
  return qs;
}

export function parseFiltersFromQuery(qs: URLSearchParams, base: ProductFilters): ProductFilters {
  const f: ProductFilters = { ...base };

  const urut = qs.get(URL_PARAM.sort);
  if (urut && SORT_OPTIONS.some((o) => o.value === urut)) f.sortBy = urut as SortKey;

  const hmin = qs.get(URL_PARAM.priceMin);
  if (hmin !== null && hmin !== "") {
    const n = Number(hmin);
    if (!Number.isNaN(n)) f.priceMin = n;
  }

  const hmax = qs.get(URL_PARAM.priceMax);
  if (hmax !== null && hmax !== "") {
    const n = Number(hmax);
    if (!Number.isNaN(n)) f.priceMax = n;
  }

  const rating = qs.get(URL_PARAM.rating);
  if (rating !== null && rating !== "") {
    const n = Number(rating);
    if (!Number.isNaN(n)) f.ratingMin = n;
  }

  const lokasi = qs.get(URL_PARAM.lokasi);
  if (lokasi) f.dikirim_dari = lokasi;

  const item = qs.get(URL_PARAM.item);
  if (item) f.item = item;

  const q = qs.get(URL_PARAM.search);
  if (q) f.search = q;

  return f;
}

// Serializes filters the way GET /api/products expects them (replaces the
// hand-rolled URLSearchParams in useProductQueries.ts).
export function filtersToApiQuery(
  f: ProductFilters,
  page: { limit: number; offset: number }
): URLSearchParams {
  const qs = new URLSearchParams();
  if (f.category) qs.set("category", f.category);
  if (f.subcategory) qs.set("subcategory", f.subcategory);
  if (f.dikirim_dari) qs.set("dikirimDari", f.dikirim_dari);
  if (f.item) qs.set("item", f.item);
  if (f.search) qs.set("search", f.search);
  if (f.priceMin !== undefined) qs.set("priceMin", String(f.priceMin));
  if (f.priceMax !== undefined) qs.set("priceMax", String(f.priceMax));
  if (f.ratingMin !== undefined) qs.set("ratingMin", String(f.ratingMin));
  if (f.sortBy) qs.set("sort", f.sortBy);
  qs.set("limit", String(page.limit));
  qs.set("offset", String(page.offset));
  return qs;
}

// How many non-default filters are active -- drives the badge on the Filter
// button. category/subcategory are route, not filter, so excluded.
export function countActiveFilters(f: ProductFilters): number {
  let count = 0;
  // Price counts as ONE filter even when both bounds are set -- picking a
  // single preset (which sets min and max together) otherwise showed "2".
  const priceMinActive = f.priceMin !== undefined && f.priceMin !== 0;
  const priceMaxActive = f.priceMax !== undefined && f.priceMax !== PRICE_MAX;
  if (priceMinActive || priceMaxActive) count++;
  if (f.ratingMin !== undefined) count++;
  if (f.dikirim_dari) count++;
  if (f.item) count++;
  return count;
}
