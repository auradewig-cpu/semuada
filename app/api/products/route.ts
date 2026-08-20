import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, isNull, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";
import { findInvalidImageUrl } from "@root/lib/imageHosts";

// Query params are user input: a non-numeric value used to become NaN and reach
// the query builder as `.limit(NaN)` / `gte(price, "NaN")`, which fails at the
// database. Anything unparseable is treated as "not supplied".
function numericParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const category = params.get("category") ?? undefined;
  const subcategory = params.get("subcategory") ?? undefined;
  const dikirimDari = params.get("dikirimDari") ?? undefined;
  const item = params.get("item") ?? undefined;
  const search = params.get("search") ?? undefined;
  const categoriesParam = params.get("categories");
  const categories = categoriesParam ? categoriesParam.split(",").filter(Boolean) : undefined;
  const priceMin = numericParam(params.get("priceMin"));
  const priceMax = numericParam(params.get("priceMax"));
  const ratingMin = numericParam(params.get("ratingMin"));
  const sort = params.get("sort") ?? undefined;
  const featured = params.get("featured") === "true";
  const nonFeatured = params.get("nonFeatured") === "true";
  // Clamp pagination so a junk ?limit=100000 can't drag the whole table back
  // into memory. Normal storefront reads cap at 100 (useFeaturedProducts uses
  // 100); the admin's useNonFeaturedProducts pulls 1000, so raise the cap on
  // that branch only rather than break it.
  let limit = numericParam(params.get("limit")) ?? 20;
  let offset = numericParam(params.get("offset")) ?? 0;
  limit = Math.min(Math.max(Math.trunc(limit), 1), nonFeatured ? 1000 : 100);
  offset = Math.max(Math.trunc(offset), 0);
  // One seed per client session makes sort=rekomendasi stable across pages of
  // the same session (previously it was reshuffled AFTER pagination, so each
  // page was a fresh random slice and products could repeat).
  const seed = params.get("seed") ?? "default";

  const conditions = [];
  if (category) conditions.push(eq(products.category, category));
  if (subcategory) conditions.push(eq(products.subcategory, subcategory));
  if (dikirimDari) conditions.push(eq(products.dikirim_dari, dikirimDari));
  if (item) conditions.push(eq(products.item, item));
  if (categories && categories.length > 0) conditions.push(inArray(products.category, categories));
  if (priceMin !== undefined) conditions.push(gte(products.price, String(priceMin)));
  if (priceMax !== undefined) conditions.push(lte(products.price, String(priceMax)));
  if (ratingMin !== undefined) conditions.push(gte(products.rating, String(ratingMin)));
  if (featured) conditions.push(eq(products.isFeatured, true));
  if (nonFeatured) conditions.push(or(ne(products.isFeatured, true), isNull(products.isFeatured)));

  if (search) {
    const terms = search.toLowerCase().trim().split(/\s+/).filter((t) => t.length > 0);
    for (const term of terms) {
      conditions.push(ilike(products.productName, `%${term}%`));
    }
  }

  let orderByClause;
  if (featured) {
    orderByClause = asc(products.featuredOrder);
  } else {
    switch (sort) {
      case "popular":
        orderByClause = desc(products.clicks);
        break;
      case "terlaris":
        orderByClause = desc(products.sales);
        break;
      case "harga_termurah":
        orderByClause = asc(products.price);
        break;
      case "harga_tertinggi":
        orderByClause = desc(products.price);
        break;
      case "newest":
        orderByClause = desc(products.createdAt);
        break;
      case "rekomendasi":
        // Deterministic pseudo-random order seeded by the client's per-session
        // seed, applied in SQL BEFORE pagination so consecutive pages are one
        // stable shuffle with no overlapping rows.
        orderByClause = sql`md5(${products.id}::text || ${seed})`;
        break;
      default:
        orderByClause = desc(products.createdAt);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  const items = rows.map(toApiProduct);

  const nextOffset = items.length === limit ? offset + limit : null;

  return NextResponse.json({ items, nextOffset });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  const invalidImageError = findInvalidImageUrl(body);
  if (invalidImageError) {
    return NextResponse.json({ error: invalidImageError }, { status: 400 });
  }

  const [row] = await db
    .insert(products)
    .values({
      productId: body.product_id,
      productName: body.product_name,
      category: body.category,
      subcategory: body.subcategory,
      originalPrice: body.original_price != null ? String(body.original_price) : undefined,
      price: String(body.price),
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
      stockAvailable: body.stock_available,
    })
    .returning();

  return NextResponse.json(toApiProduct(row), { status: 201 });
}
