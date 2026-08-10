import { notFound } from "next/navigation";
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

  // An unknown slug used to fall through to the unfiltered "Semua Produk"
  // view, so ANY two-word URL answered 200 with the full catalogue --
  // /asdfghjkl, /ngawur/banget, even /api/apa-saja. A soft 404: the same
  // content served at unbounded distinct URLs, which search engines read as
  // duplicate pages. Harmless-ish while those responses were `no-store`;
  // once the route became ISR-cached each junk URL also earned its own edge
  // cache entry. The hierarchy is read live per request, so a category added
  // after the last build still resolves here -- only genuinely absent slugs
  // reach this.
  if (!category) notFound();

  const filters = { ...DEFAULT_PRODUCT_FILTERS, category, subcategory: undefined };

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
    eq(products.category, category),
  ];

  const queryClient = new QueryClient();

  const [featuredRows, firstPageRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.isFeatured, true), eq(products.category, category)))
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
