// Base FilterState shared by every server-side product-grid prefetch (the
// homepage and category pages). Must stay structurally identical (after
// JSON.stringify drops undefined-valued keys) to Home.tsx's initial
// useState<FilterState> for the corresponding route, since this is what
// useInfiniteProducts(filters)/useFeaturedProducts(category) hash their
// query keys from -- only `category`/`subcategory` vary per page.
export const DEFAULT_PRODUCT_FILTERS = {
  search: "",
  priceMin: 0,
  priceMax: 20000000,
  sortBy: "newest",
  dikirim_dari: undefined,
  item: undefined,
} as const;
