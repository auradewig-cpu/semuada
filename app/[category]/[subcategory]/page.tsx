import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { getCategoryHierarchy, getSubcategoryParams, getCategoryCatalog, resolveCategorySlug } from "@root/lib/categories";
import { buildInitialFilters } from "@root/lib/productFilters";
import { getSiteSettings } from "@root/lib/site-settings";
import { SITE_URL } from "@root/lib/siteUrl";
import { CatalogPage } from "@/pages/CatalogPage";

export const revalidate = 60;

// Required for `revalidate` above to mean anything -- see getSubcategoryParams().
export function generateStaticParams() {
  return getSubcategoryParams();
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; subcategory: string }> }): Promise<Metadata> {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;
  const hierarchy = await getCategoryHierarchy();
  const { category, subcategory } = resolveCategorySlug(hierarchy, categorySlug, subcategorySlug);
  if (!category || !subcategory) return {};

  const catalog = await getCategoryCatalog();
  const entry = catalog.find((c) => c.name === category);
  const sub = entry?.subcategories.find((s) => s.name === subcategory);
  const { siteName } = await getSiteSettings();

  return {
    title: `${subcategory}${sub && sub.productCount > 0 ? ` — ${sub.productCount} produk` : ""} | ${siteName}`,
    description: `Jelajahi produk ${subcategory} dalam kategori ${category} di ${siteName}. Bandingkan harga, rating, dan lokasi toko.`,
    alternates: { canonical: `/${categorySlug}/${subcategorySlug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;

  // Same server-side slug resolution as app/[category]/page.tsx -- see that
  // file's comment for why this avoids a discarded unfiltered first fetch.
  const hierarchy = await getCategoryHierarchy();
  const { category, subcategory } = resolveCategorySlug(hierarchy, categorySlug, subcategorySlug);

  // Requiring BOTH to resolve rejects valid-looking pairs whose subcategory
  // belongs to a different category (resolveCategorySlug scopes the lookup).
  if (!category || !subcategory) notFound();

  const filters = buildInitialFilters({ category, subcategory });
  const categories = await getCategoryCatalog();

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
    eq(products.category, category),
    eq(products.subcategory, subcategory),
  ];

  const queryClient = new QueryClient();

  const [firstPageRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(...productConditions))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
  ]);

  queryClient.setQueryData(["products-infinite", filters], {
    pages: [firstPageRows.map(toApiProduct)],
    pageParams: [0],
  });

  // Absolute URLs -- see the note in app/[category]/page.tsx.
  const itemList = [
    { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: category, item: `${SITE_URL}/${categorySlug}` },
    {
      "@type": "ListItem",
      position: 3,
      name: subcategory,
      item: `${SITE_URL}/${categorySlug}/${subcategorySlug}`,
    },
  ];

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: itemList,
          }),
        }}
      />
      <CatalogPage
        categoryName={category}
        subcategoryName={subcategory}
        categorySlug={categorySlug}
        subcategorySlug={subcategorySlug}
        categories={categories}
      />
    </HydrationBoundary>
  );
}
