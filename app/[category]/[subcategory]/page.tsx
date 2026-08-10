import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { getCategoryHierarchy, getSubcategoryParams, resolveCategorySlug } from "@root/lib/categories";
import { DEFAULT_PRODUCT_FILTERS } from "@root/lib/productFilters";
import Home from "@/pages/Home";

export const revalidate = 60;

// Required for `revalidate` above to mean anything -- see getSubcategoryParams().
export function generateStaticParams() {
  return getSubcategoryParams();
}

export default async function Page({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;

  // Same server-side slug resolution as app/[category]/page.tsx -- see that
  // file's comment for why this avoids a discarded unfiltered first fetch.
  const hierarchy = await getCategoryHierarchy();
  const { category, subcategory } = resolveCategorySlug(hierarchy, categorySlug, subcategorySlug);

  // Same soft-404 fix as app/[category]/page.tsx, and it matters more here:
  // this route is what caught every unmatched two-segment URL. Requiring BOTH
  // to resolve also rejects a valid-looking pair whose subcategory belongs to
  // a different category (resolveCategorySlug now scopes the lookup), which
  // used to render an empty grid at 200.
  if (!category || !subcategory) notFound();

  const filters = { ...DEFAULT_PRODUCT_FILTERS, category, subcategory };

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
    eq(products.category, category),
    eq(products.subcategory, subcategory),
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
      <Home categorySlug={categorySlug} subcategorySlug={subcategorySlug} initialCategory={category} initialSubcategory={subcategory} />
    </HydrationBoundary>
  );
}
