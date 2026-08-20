import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { settings } from "@shared/schema";
import { toApiSettings } from "@root/lib/mappers";

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

export const DEFAULT_SITE_NAME = "SEMUADA";

// The settings row in the exact shape GET /api/settings returns -- i.e. what
// useSettings()'s ["settings"] query cache holds. app/layout.tsx prefetches it
// with this so the header/footer render the real site identity in the first
// HTML; the API route serves the same thing.
//
// The "no row yet" fallback lives here and ONLY here. It used to be written out
// three times (the route, app/page.tsx's prefetch, each with a "keep in sync"
// comment), and features gated on a setting must not silently switch off just
// because nobody has saved the Settings form yet.
export const getApiSiteSettings = cache(async () => {
  const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
  if (row) return toApiSettings(row);
  return {
    id: SETTINGS_ID,
    show_category_filter: true,
    updated_at: null,
    facebook_pixel_id: null,
    google_analytics_id: null,
    site_name: DEFAULT_SITE_NAME,
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
  };
});

// Server-only, request-deduped read of the single settings row -- used by
// generateMetadata()/Server Components that need site identity (name,
// tagline, logo, SEO fields) without an extra HTTP round-trip through our
// own /api/settings route. `cache()` ensures multiple call sites within the
// same request (e.g. layout + a page's generateMetadata) share one DB read.
export const getSiteSettings = cache(async () => {
  const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
  return {
    siteName: row?.siteName || DEFAULT_SITE_NAME,
    siteTagline: row?.siteTagline || null,
    logoUrl: row?.logoUrl || null,
    faviconUrl: row?.faviconUrl || null,
    seoMetaDescription: row?.seoMetaDescription || null,
    ogImageUrl: row?.ogImageUrl || null,
    maintenanceMode: row?.maintenanceMode ?? false,
    maintenanceMessage: row?.maintenanceMessage || null,
  };
});

// Deliberately NOT wrapped in `cache()`: this one is called from middleware.ts,
// which runs outside any React render, where `cache()` has no request scope to
// dedupe against. It also selects a single boolean column instead of the whole
// row -- middleware only ever needs the gate, and it pays for this read on
// every cache miss.
export async function getMaintenanceFlag(): Promise<boolean> {
  const [row] = await db
    .select({ maintenanceMode: settings.maintenanceMode })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID));
  return row?.maintenanceMode ?? false;
}
