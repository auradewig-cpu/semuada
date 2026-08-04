import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { settings } from "@shared/schema";
import { toApiSettings } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

export async function GET() {
  const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
  if (row) {
    return NextResponse.json(toApiSettings(row));
  }
  // No settings row yet (e.g. fresh database) -- fall back to schema
  // defaults instead of null, so features gated on a setting (like the
  // category filter) aren't silently hidden just because nobody has
  // saved the Settings form yet.
  return NextResponse.json({
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
  });
}

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  const [row] = await db
    .insert(settings)
    .values({
      id: SETTINGS_ID,
      showCategoryFilter: body.show_category_filter,
      facebookPixelId: body.facebook_pixel_id,
      googleAnalyticsId: body.google_analytics_id,
      siteName: body.site_name,
      siteTagline: body.site_tagline,
      logoUrl: body.logo_url,
      faviconUrl: body.favicon_url,
      contactEmail: body.contact_email,
      contactPhone: body.contact_phone,
      contactAddress: body.contact_address,
      whatsappNumber: body.whatsapp_number,
      socialFacebookUrl: body.social_facebook_url,
      socialTwitterUrl: body.social_twitter_url,
      socialInstagramUrl: body.social_instagram_url,
      seoMetaDescription: body.seo_meta_description,
      ogImageUrl: body.og_image_url,
      maintenanceMode: body.maintenance_mode,
      maintenanceMessage: body.maintenance_message,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        showCategoryFilter: body.show_category_filter,
        facebookPixelId: body.facebook_pixel_id,
        googleAnalyticsId: body.google_analytics_id,
        siteName: body.site_name,
        siteTagline: body.site_tagline,
        logoUrl: body.logo_url,
        faviconUrl: body.favicon_url,
        contactEmail: body.contact_email,
        contactPhone: body.contact_phone,
        contactAddress: body.contact_address,
        whatsappNumber: body.whatsapp_number,
        socialFacebookUrl: body.social_facebook_url,
        socialTwitterUrl: body.social_twitter_url,
        socialInstagramUrl: body.social_instagram_url,
        seoMetaDescription: body.seo_meta_description,
        ogImageUrl: body.og_image_url,
        maintenanceMode: body.maintenance_mode,
        maintenanceMessage: body.maintenance_message,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(toApiSettings(row));
}
