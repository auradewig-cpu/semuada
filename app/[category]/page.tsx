import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { getCategoryHierarchy, getCategoryParams, resolveCategorySlug } from "@root/lib/categories";
import { DEFAULT_PRODUCT_FILTERS } from "@root/lib/productFilters";
import Home from "@/pages/Home";

export const revalidate = 60;

// Required for `revalidate` above to mean anything -- see getCategoryParams().
export function generateStaticParams() {
  return getCategoryParams();
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params;

  // Resolve the URL slug back to the real category name server-side so the
  // very first product/featured fetch is already filtered correctly --
  // previously this page rendered <Home categorySlug={...}> with zero
  // server data, so the client mounted with an unfiltered "Semua Produk"
  // query, fetched it, then only afterwards resolved the slug and refetched
  // filtered data. That double round-trip was the dominant chunk of this
  // route's LCP delay (see homepage_performance memory).
  const hierarchy = await getCategoryHierarchy();
  const { category } = resolveCategorySlug(hierarchy, categorySlug);

  const filters = { ...DEFAULT_PRODUCT_FILTERS, category, subcategory: undefined };

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
  ];
  if (category) productConditions.push(eq(products.category, category));

  const queryClient = new QueryClient();

  const [featuredRows, firstPageRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(category ? and(eq(products.isFeatured, true), eq(products.category, category)) : eq(products.isFeatured, true))
      .orderBy(asc(products.featuredOrder))
      .limit(100),
    db
      .select()
      .from(products)
      .where(and(...productConditions))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
  ]);

  queryClient.setQueryData(["featuredProducts", category], featuredRows.map(toApiProduct));
  queryClient.setQueryData(["products-infinite", filters], {
    pages: [firstPageRows.map(toApiProduct)],
    pageParams: [0],
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Home categorySlug={categorySlug} initialCategory={category} />
    </HydrationBoundary>
  );
}
