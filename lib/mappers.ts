import type { Product as DbProduct, Settings as DbSettings } from "@shared/schema";

export function toApiProduct(row: DbProduct) {
  return {
    id: row.id,
    product_id: row.productId,
    product_name: row.productName,
    price: row.price,
    original_price: row.originalPrice,
    sales: row.sales,
    category: row.category,
    subcategory: row.subcategory,
    item: row.item,
    affiliate_url: row.affiliateUrl,
    image_url: row.imageUrl,
    video_url: row.video_url,
    rating: row.rating,
    commission: row.commission,
    dikirim_dari: row.dikirim_dari,
    toko: row.toko,
    is_featured: row.isFeatured,
    featured_order: row.featuredOrder,
    created_at: row.createdAt,
    stock_available: row.stockAvailable,
    clicks: row.clicks,
  };
}

export function toApiSettings(row: DbSettings) {
  return {
    id: row.id,
    show_category_filter: row.showCategoryFilter,
    updated_at: row.updatedAt,
    facebook_pixel_id: row.facebookPixelId,
    google_analytics_id: row.googleAnalyticsId,
  };
}
