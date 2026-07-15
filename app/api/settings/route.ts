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
  return NextResponse.json(row ? toApiSettings(row) : null);
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
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        showCategoryFilter: body.show_category_filter,
        facebookPixelId: body.facebook_pixel_id,
        googleAnalyticsId: body.google_analytics_id,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(toApiSettings(row));
}
