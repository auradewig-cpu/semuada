import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { settings } from "@shared/schema";
import { toApiSettings } from "@root/lib/mappers";
import { getApiSiteSettings } from "@root/lib/site-settings";
import { requireAuth } from "@root/lib/apiAuth";

const SETTINGS_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

// Shape + "no settings row yet" fallback both live in getApiSiteSettings(),
// which app/layout.tsx also uses to prefetch the ["settings"] query -- the two
// must agree, and previously each wrote its own copy of the fallback object.
export async function GET() {
  return NextResponse.json(await getApiSiteSettings());
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
