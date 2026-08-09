import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, settings } from "@shared/schema";
import { toApiProduct, toApiSettings } from "@root/lib/mappers";
import { PRODUCTS_PER_PAGE } from "@/hooks/useProductQueries";
import Home from "@/pages/Home";

export const revalidate = 60;

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

// Must stay structurally identical (after JSON.stringify drops undefined
// keys) to Home.tsx's initial useState<FilterState> -- this is the query key
// useInfiniteProducts(filters) hashes to on first render, and the prefetch
// below only avoids a client-side waterfall if the hash matches exactly.
const DEFAULT_HOME_FILTERS = {
  search: '',
  priceMin: 0,
  priceMax: 20000000,
  sortBy: 'newest',
  dikirim_dari: undefined,
  item: undefined,
};

export default async function Page() {
  const queryClient = new QueryClient();

  const [featuredRows, firstPageRows, settingsRow] = await Promise.all([
    db.select().from(products).where(eq(products.isFeatured, true)).orderBy(asc(products.featuredOrder)).limit(100),
    // Mirrors GET /api/products' default path (no category/search/etc,
    // sort=newest) for DEFAULT_HOME_FILTERS above -- this is the main
    // "Semua Produk" grid, previously fetched entirely client-side after
    // hydration (a loading skeleton flash on every fresh homepage visit).
    db
      .select()
      .from(products)
      .where(and(gte(products.price, String(DEFAULT_HOME_FILTERS.priceMin)), lte(products.price, String(DEFAULT_HOME_FILTERS.priceMax))))
      .orderBy(desc(products.createdAt))
      .limit(PRODUCTS_PER_PAGE)
      .offset(0),
    db.select().from(settings).where(eq(settings.id, SETTINGS_ID)),
  ]);

  queryClient.setQueryData(["featuredProducts", undefined], featuredRows.map(toApiProduct));
  queryClient.setQueryData(["products-infinite", DEFAULT_HOME_FILTERS], {
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
