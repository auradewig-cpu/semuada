import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { getCategoryHierarchy, getCategoryParams, getCategoryCatalog, resolveCategorySlug } from "@root/lib/categories";
import { buildInitialFilters } from "@root/lib/productFilters";
import { getLocationOptions } from "@root/lib/productOptions";
import { getSiteSettings } from "@root/lib/site-settings";
import { SITE_URL } from "@root/lib/siteUrl";
import { CatalogPage } from "@/pages/CatalogPage";

export const revalidate = 60;

// Required for `revalidate` above to mean anything -- see getCategoryParams().
export function generateStaticParams() {
  return getCategoryParams();
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const hierarchy = await getCategoryHierarchy();
  const { category } = resolveCategorySlug(hierarchy, categorySlug);
  if (!category) return {};

  const catalog = await getCategoryCatalog();
  const entry = catalog.find((c) => c.name === category);
  const { siteName } = await getSiteSettings();
  const count = entry?.productCount ?? 0;

  return {
    title: `${category}${count > 0 ? ` — ${count} produk` : ""} | ${siteName}`,
    description: `Jelajahi produk ${category} terbaik di ${siteName}. Bandingkan harga, rating, dan lokasi toko.`,
    alternates: { canonical: `/${categorySlug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params;

  // Resolve the URL slug back to the real category name server-side so the
  // very first product fetch is already filtered correctly (see the note on
  // this in the previous Home-based version of this page).
  const hierarchy = await getCategoryHierarchy();
  const { category } = resolveCategorySlug(hierarchy, categorySlug);

  // Unknown slugs are a soft 404 rather than the unfiltered catalogue.
  if (!category) notFound();

  const filters = buildInitialFilters({ category });
  const categories = await getCategoryCatalog();

  const productConditions = [
    gte(products.price, String(filters.priceMin)),
    lte(products.price, String(filters.priceMax)),
    eq(products.category, category),
  ];

  const queryClient = new QueryClient();

  const [firstPageRows, locationOptions] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(...productConditions))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
    getLocationOptions(category),
  ]);

  queryClient.setQueryData(["products-infinite", filters], {
    pages: [firstPageRows.map(toApiProduct)],
    pageParams: [0],
  });
  // Key must match useLocationOptions(category, subcategory) exactly -- the
  // trailing `undefined` is part of it. The desktop filter sidebar is mounted
  // (just CSS-hidden) on mobile too, so without this every category page view
  // fetched these options over HTTP for a panel nobody had opened.
  queryClient.setQueryData(["locationOptions", category, undefined], locationOptions);

  // schema.org wants absolute URLs here; relative paths are ignored by
  // validators. SITE_URL is the same origin the sitemap/robots are built from.
  const itemList = [
    { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: category, item: `${SITE_URL}/${categorySlug}` },
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
        categorySlug={categorySlug}
        categories={categories}
      />
    </HydrationBoundary>
  );
}
