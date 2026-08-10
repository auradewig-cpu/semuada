import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { settings } from "@shared/schema";

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

export const DEFAULT_SITE_NAME = "SEMUADA";

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
