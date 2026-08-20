import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { DEFAULT_PRODUCT_FILTERS } from "@root/lib/productFilters";
import { getCategoryCatalog } from "@root/lib/categories";
import HomePage from "@/pages/HomePage";

export const revalidate = 60;

export default async function Page() {
  const queryClient = new QueryClient();

  // Settings are NOT prefetched here any more -- app/layout.tsx does it, which
  // also covers SiteFooter (mounted by the layout, so a page-level prefetch
  // never reached it) and every non-home route.
  const [featuredRows, firstPageRows, categories, bestSellerRows] = await Promise.all([
    db.select().from(products).where(eq(products.isFeatured, true)).orderBy(asc(products.featuredOrder)).limit(100),
    // Mirrors GET /api/products' default path (no category/search/etc,
    // sort=newest) for DEFAULT_PRODUCT_FILTERS -- this is the main
    // "Rekomendasi Untukmu" grid, previously fetched entirely client-side after
    // hydration (a loading skeleton flash on every fresh homepage visit).
    db
      .select()
      .from(products)
      .where(and(gte(products.price, String(DEFAULT_PRODUCT_FILTERS.priceMin)), lte(products.price, String(DEFAULT_PRODUCT_FILTERS.priceMax))))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
    // Sorted by product count; passed as a plain prop so the category grid
    // ships in the first HTML with zero extra client requests.
    getCategoryCatalog(),
    // "Terlaris Minggu Ini" strip (sort=terlaris).
    db
      .select()
      .from(products)
      .orderBy(desc(products.sales))
      .limit(10),
  ]);
  // categoryHierarchy is prefetched in app/layout.tsx, not here -- its
  // consumer (CategoryContext) is mounted globally in app/providers.tsx as a
  // PARENT of this page's HydrationBoundary, so hydrating it from here would
  // never actually reach it (React renders CategoryProvider's useCategories()
  // call before this component's HydrationBoundary hydrates, since parents
  // render before children -- confirmed by inspecting the still-loading
  // category skeleton in the prerendered output before this was moved).

  queryClient.setQueryData(["featuredProducts", undefined], featuredRows.map(toApiProduct));
  queryClient.setQueryData(["bestSellers", 10], bestSellerRows.map(toApiProduct));
  queryClient.setQueryData(["products-infinite", DEFAULT_PRODUCT_FILTERS], {
    pages: [firstPageRows.map(toApiProduct)],
    pageParams: [0],
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePage categories={categories} />
    </HydrationBoundary>
  );
}
