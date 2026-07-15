import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, isNull, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  const priceMin = params.get("priceMin") ? Number(params.get("priceMin")) : undefined;
  const priceMax = params.get("priceMax") ? Number(params.get("priceMax")) : undefined;
  const sort = params.get("sort") ?? undefined;
  const featured = params.get("featured") === "true";
  const nonFeatured = params.get("nonFeatured") === "true";
  const limit = params.get("limit") ? Number(params.get("limit")) : 20;
  const offset = params.get("offset") ? Number(params.get("offset")) : 0;

  const conditions = [];
  if (category) conditions.push(eq(products.category, category));
  if (subcategory) conditions.push(eq(products.subcategory, subcategory));
  if (dikirimDari) conditions.push(eq(products.dikirim_dari, dikirimDari));
  if (item) conditions.push(eq(products.item, item));
  if (categories && categories.length > 0) conditions.push(inArray(products.category, categories));
  if (priceMin !== undefined) conditions.push(gte(products.price, String(priceMin)));
  if (priceMax !== undefined) conditions.push(lte(products.price, String(priceMax)));
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

  let items = rows.map(toApiProduct);
  if (sort === "rekomendasi") {
    items = shuffle(items);
  }

  const nextOffset = items.length === limit ? offset + limit : null;

  return NextResponse.json({ items, nextOffset });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

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
    })
    .returning();

  return NextResponse.json(toApiProduct(row), { status: 201 });
}
