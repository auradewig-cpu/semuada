import type { Product as DbProduct, Settings as DbSettings, AiSettings as DbAiSettings } from "@shared/schema";

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
    image_urls: row.imageUrls,
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

// Never return raw API keys to the client -- only whether one is saved, so
// the Settings UI can show "saved" state without the key ever touching the
// browser/network tab after the initial save.
export function toApiAiSettings(row: DbAiSettings) {
  return {
    id: row.id,
    gemini_model: row.geminiModel,
    provider_order: row.providerOrder,
    updated_at: row.updatedAt,
    has_gemini_key: Boolean(row.geminiApiKey),
    has_groq_key: Boolean(row.groqApiKey),
    has_openrouter_key: Boolean(row.openrouterApiKey),
    has_deepseek_key: Boolean(row.deepseekApiKey),
  };
}
