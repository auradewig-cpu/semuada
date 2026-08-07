import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { toApiVideoContent } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

// Admin-only video library -- not customer-facing, so both read and write
// are gated (unlike /api/products, which has a public GET).
export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const category = request.nextUrl.searchParams.get("category");

  const rows = category
    ? await db.select().from(videoContents).where(eq(videoContents.category, category)).orderBy(desc(videoContents.createdAt))
    : await db.select().from(videoContents).orderBy(desc(videoContents.createdAt));

  return NextResponse.json({ items: rows.map(toApiVideoContent) });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);

  // product_id is optional -- manual uploads (not routed through Content
  // Generator) are tied to a category only, not a specific product row.
  if (typeof body?.category !== "string" || !body.category) {
    return NextResponse.json({ error: "category wajib diisi." }, { status: 400 });
  }
  if (typeof body?.video_url !== "string" || !body.video_url) {
    return NextResponse.json({ error: "video_url wajib diisi." }, { status: 400 });
  }
  if (typeof body?.cloudinary_public_id !== "string" || !body.cloudinary_public_id) {
    return NextResponse.json({ error: "cloudinary_public_id wajib diisi." }, { status: 400 });
  }

  const [row] = await db
    .insert(videoContents)
    .values({
      productId: typeof body.product_id === "string" && body.product_id ? body.product_id : undefined,
      category: body.category,
      subcategory: typeof body.subcategory === "string" ? body.subcategory : undefined,
      caption: typeof body.caption === "string" ? body.caption : undefined,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((h: unknown) => typeof h === "string") : undefined,
      promptSnapshot: typeof body.prompt_snapshot === "string" ? body.prompt_snapshot : undefined,
      videoUrl: body.video_url,
      cloudinaryPublicId: body.cloudinary_public_id,
      // Carried straight through from the /sign response that produced this
      // upload -- always the account actually used, no re-resolution here.
      storageAccountId: typeof body.storage_account_id === "string" && body.storage_account_id ? body.storage_account_id : undefined,
    })
    .returning();

  return NextResponse.json(toApiVideoContent(row), { status: 201 });
}
