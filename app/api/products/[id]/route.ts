import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();

  const [row] = await db
    .update(products)
    .set({
      productId: body.product_id,
      productName: body.product_name,
      category: body.category,
      subcategory: body.subcategory,
      originalPrice: body.original_price != null ? String(body.original_price) : undefined,
      price: body.price != null ? String(body.price) : undefined,
      sales: body.sales,
      item: body.item || "",
      commission: body.commission != null ? String(body.commission) : undefined,
      dikirim_dari: body.dikirim_dari,
      toko: body.toko,
      affiliateUrl: body.affiliate_url,
      imageUrl: body.image_url,
      imageUrls: Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : undefined,
      video_url: body.video_url || "",
      rating: body.rating != null ? String(body.rating) : undefined,
      isFeatured: body.is_featured,
      featuredOrder: body.featured_order,
    })
    .where(eq(products.id, id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toApiProduct(row));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await db.delete(products).where(eq(products.id, id));

  return NextResponse.json({ ok: true });
}
