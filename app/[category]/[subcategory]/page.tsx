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

  const filters = { ...DEFAULT_PRODUCT_FILTERS, category, subcategory };

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
  ];
  if (category) productConditions.push(eq(products.category, category));
  if (subcategory) productConditions.push(eq(products.subcategory, subcategory));

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
      <Home categorySlug={categorySlug} subcategorySlug={subcategorySlug} initialCategory={category} initialSubcategory={subcategory} />
    </HydrationBoundary>
  );
}
