import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, settings } from "@shared/schema";
import { toApiProduct, toApiSettings } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import { DEFAULT_PRODUCT_FILTERS } from "@root/lib/productFilters";
import Home from "@/pages/Home";

export const revalidate = 60;

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

export default async function Page() {
  const queryClient = new QueryClient();

  const [featuredRows, firstPageRows, settingsRow] = await Promise.all([
    db.select().from(products).where(eq(products.isFeatured, true)).orderBy(asc(products.featuredOrder)).limit(100),
    // Mirrors GET /api/products' default path (no category/search/etc,
    // sort=newest) for DEFAULT_PRODUCT_FILTERS -- this is the main
    // "Semua Produk" grid, previously fetched entirely client-side after
    // hydration (a loading skeleton flash on every fresh homepage visit).
    db
      .select()
      .from(products)
      .where(and(gte(products.price, String(DEFAULT_PRODUCT_FILTERS.priceMin)), lte(products.price, String(DEFAULT_PRODUCT_FILTERS.priceMax))))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
    db.select().from(settings).where(eq(settings.id, SETTINGS_ID)),
  ]);
  // categoryHierarchy is prefetched in app/layout.tsx, not here -- its
  // consumer (CategoryContext) is mounted globally in app/providers.tsx as a
  // PARENT of this page's HydrationBoundary, so hydrating it from here would
  // never actually reach it (React renders CategoryProvider's useCategories()
  // call before this component's HydrationBoundary hydrates, since parents
  // render before children -- confirmed by inspecting the still-loading
  // category skeleton in the prerendered output before this was moved).

  queryClient.setQueryData(["featuredProducts", undefined], featuredRows.map(toApiProduct));
  queryClient.setQueryData(["products-infinite", DEFAULT_PRODUCT_FILTERS], {
    pages: [firstPageRows.map(toApiProduct)],
    pageParams: [0],
  });
  // Same "no row yet" fallback as GET /api/settings -- keep in sync with
  // app/api/settings/route.ts if that fallback ever changes.
  queryClient.setQueryData(
    ["settings"],
    settingsRow[0]
      ? toApiSettings(settingsRow[0])
      : {
          id: SETTINGS_ID,
          show_category_filter: true,
          updated_at: null,
          facebook_pixel_id: null,
          google_analytics_id: null,
          site_name: "SEMUADA",
          site_tagline: null,
          logo_url: null,
          favicon_url: null,
          contact_email: null,
          contact_phone: null,
          contact_address: null,
          whatsapp_number: null,
          social_facebook_url: null,
          social_twitter_url: null,
          social_instagram_url: null,
          seo_meta_description: null,
          og_image_url: null,
          maintenance_mode: false,
          maintenance_message: null,
        }
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Home />
    </HydrationBoundary>
  );
}
