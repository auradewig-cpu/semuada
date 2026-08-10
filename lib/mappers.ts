import type { Product as DbProduct, Settings as DbSettings, AiSettings as DbAiSettings, Character as DbCharacter, VideoContent as DbVideoContent, VideoStorageAccount as DbVideoStorageAccount, SchedulerAccount as DbSchedulerAccount, ScheduledPost as DbScheduledPost } from "@shared/schema";

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
    site_name: row.siteName,
    site_tagline: row.siteTagline,
    logo_url: row.logoUrl,
    favicon_url: row.faviconUrl,
    contact_email: row.contactEmail,
    contact_phone: row.contactPhone,
    contact_address: row.contactAddress,
    whatsapp_number: row.whatsappNumber,
    social_facebook_url: row.socialFacebookUrl,
    social_twitter_url: row.socialTwitterUrl,
    social_instagram_url: row.socialInstagramUrl,
    seo_meta_description: row.seoMetaDescription,
    og_image_url: row.ogImageUrl,
    maintenance_mode: row.maintenanceMode,
    maintenance_message: row.maintenanceMessage,
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
    narration_wpm: row.narrationWpm,
    updated_at: row.updatedAt,
    has_gemini_key: Boolean(row.geminiApiKey),
    has_groq_key: Boolean(row.groqApiKey),
    has_openrouter_key: Boolean(row.openrouterApiKey),
    has_deepseek_key: Boolean(row.deepseekApiKey),
  };
}

// Character photos live in a private Blob store -- the raw blob URL isn't
// browser-accessible, so the client gets a proxied URL through our own
// authenticated route instead. The raw URL is still used internally (e.g.
// by the Gemini vision call) straight from the DB row.
export function toCharacterPhotoProxyUrl(rawBlobUrl: string): string {
  return `/api/content-generator/characters/photo?url=${encodeURIComponent(rawBlobUrl)}`;
}

export function toApiCharacter(row: DbCharacter) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: toCharacterPhotoProxyUrl(row.photoUrl),
    description: row.description,
    createdAt: row.createdAt,
  };
}

export function toApiVideoContent(row: DbVideoContent) {
  return {
    id: row.id,
    product_id: row.productId,
    category: row.category,
    subcategory: row.subcategory,
    caption: row.caption,
    hashtags: row.hashtags,
    prompt_snapshot: row.promptSnapshot,
    video_url: row.videoUrl,
    cloudinary_public_id: row.cloudinaryPublicId,
    status: row.status,
    trashed_at: row.trashedAt,
    created_at: row.createdAt,
  };
}

// Same masking convention as toApiAiSettings() -- key/secret never reach the
// browser after saving, only whether they're set.
export function toApiVideoStorageAccount(row: DbVideoStorageAccount) {
  return {
    id: row.id,
    category: row.category,
    cloud_name: row.cloudName,
    has_api_key: Boolean(row.apiKey),
    has_api_secret: Boolean(row.apiSecret),
    updated_at: row.updatedAt,
  };
}

// Same masking convention as above -- the two provider API keys never reach
// the browser after saving, only whether each is set. Platform account IDs
// aren't secret (they're just channel identifiers, same sensitivity as
// cloud_name above) so those pass through as-is.
export function toApiSchedulerAccount(row: DbSchedulerAccount) {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    has_buffer_api_key: Boolean(row.bufferApiKey),
    has_zernio_api_key: Boolean(row.zernioApiKey),
    tiktok_account_id: row.tiktokAccountId,
    instagram_account_id: row.instagramAccountId,
    youtube_account_id: row.youtubeAccountId,
    threads_account_id: row.threadsAccountId,
    facebook_page_account_id: row.facebookPageAccountId,
    base_times: row.baseTimes,
    increment_minutes: row.incrementMinutes,
    cap_time: row.capTime,
    rotation_day_index: row.rotationDayIndex,
    last_built_date: row.lastBuiltDate,
    // Exposed so the admin UI can apply the same frequency-ramp rule the
    // build cron does -- without it the scheduler tab assumes every account
    // fills all of its baseTimes daily and warns about a video shortage that
    // isn't real.
    ramp_started_at: row.rampStartedAt,
    is_active: row.isActive,
    updated_at: row.updatedAt,
  };
}

export function toApiScheduledPost(row: DbScheduledPost) {
  return {
    id: row.id,
    scheduler_account_id: row.schedulerAccountId,
    video_content_id: row.videoContentId,
    scheduled_for: row.scheduledFor,
    platforms: row.platforms,
    status: row.status,
    provider_results: row.providerResults,
    posted_at: row.postedAt,
    error_message: row.errorMessage,
    created_at: row.createdAt,
  };
}
