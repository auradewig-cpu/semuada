import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id"),
  productName: text("product_name").notNull(),
  price: numeric("price").notNull(),
  originalPrice: numeric("original_price"),
  sales: integer("sales").default(0),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  affiliateUrl: text("affiliate_url"),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array(),
  rating: numeric("rating").default("0"),
  commission: numeric("commission").default("0"),
  dikirim_dari: text("dikirim_dari"),
  toko: text("toko"),
  item: text("item"),
  video_url: text("video_url"),
  isFeatured: boolean("is_featured").default(false),
  featuredOrder: integer("featured_order"),
  stockAvailable: boolean("stock_available").default(true),
  clicks: integer("clicks").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productAnalytics = pgTable("product_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull(),
  eventType: text("event_type").notNull(), // 'click', 'view', 'purchase'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  showCategoryFilter: boolean("show_category_filter").default(true),
  facebookPixelId: text("facebook_pixel_id"),
  googleAnalyticsId: text("google_analytics_id"),
  siteName: text("site_name").default("SEMUADA"),
  siteTagline: text("site_tagline"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactAddress: text("contact_address"),
  whatsappNumber: text("whatsapp_number"),
  socialFacebookUrl: text("social_facebook_url"),
  socialTwitterUrl: text("social_twitter_url"),
  socialInstagramUrl: text("social_instagram_url"),
  seoMetaDescription: text("seo_meta_description"),
  ogImageUrl: text("og_image_url"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  maintenanceMessage: text("maintenance_message"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  geminiApiKey: text("gemini_api_key"),
  geminiModel: text("gemini_model").default("gemini-flash-latest"),
  groqApiKey: text("groq_api_key"),
  openrouterApiKey: text("openrouter_api_key"),
  deepseekApiKey: text("deepseek_api_key"),
  providerOrder: text("provider_order").array().default(sql`ARRAY['gemini','groq','openrouter','deepseek']`),
  narrationWpm: integer("narration_wpm").default(180),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contentGenerations = pgTable("content_generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull(),
  characterId: uuid("character_id"),
  style: text("style").notNull(),
  output: text("output").notNull(),
  // Denormalized copies of fields already inside `output`'s JSON -- kept as
  // real columns (rather than parsing the blob) so lib/content-generator/
  // variationContext.ts can cheaply query recent generations per product to
  // nudge the AI away from repeating itself. Nullable: old rows predate this
  // and are never backfilled, only new rows going forward carry these.
  hookArchetype: text("hook_archetype"),
  contentGoal: text("content_goal"),
  ctaType: text("cta_type"),
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Uploaded final-render videos (from Google Flow etc.), organized by the
// product's category at upload time. Deliberately its own table rather than
// hung off `content_generations` -- that table is write-only/orphaned (no id
// ever returned to the client, no update path), so this is a clean slate
// purpose-built for the video library + future social scheduling feature.
// One Cloudinary account per product category (free-tier storage is spread
// across several accounts to scale past a single account's quota). Category
// is unique -- resolveStorageAccount() in lib/videoStorage.ts falls back to
// the "Perawatan & Kecantikan" row for any category without its own account.
export const videoStorageAccounts = pgTable("video_storage_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category").notNull().unique(),
  cloudName: text("cloud_name").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const videoContents = pgTable("video_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable: videos uploaded manually (not through Content Generator) are
  // tied to a category only, not necessarily a specific product row.
  productId: uuid("product_id"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  promptSnapshot: text("prompt_snapshot"),
  videoUrl: text("video_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  // Which Cloudinary account this video's bytes actually live in -- fixed at
  // upload time (see sign/route.ts), never re-resolved later, so adding a
  // dedicated account for a category afterward doesn't strand old videos.
  storageAccountId: uuid("storage_account_id").references(() => videoStorageAccounts.id),
  // Lifecycle: "uploaded" (available in the scheduler's video pool) ->
  // "scheduled" (claimed by one scheduled_posts row, prevents double-claim
  // across accounts sharing a category) -> "posted" (successfully posted,
  // trashedAt set -- see below).
  status: text("status").default("uploaded"),
  // Set when a post using this video succeeds. Starts the 30-day countdown
  // before the trash-purge cron permanently deletes the row + Cloudinary
  // asset (see destroyVideoAsset() in lib/videoStorage.ts). Null = not yet
  // posted / not in trash.
  trashedAt: timestamp("trashed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// One row per social-scheduling "akun" (business account) -- credentials for
// the two providers that together cover its 5 platforms, plus its own
// rotating posting-time pattern. Platform-to-provider is fixed by the user's
// actual free-tier connections (Buffer: TikTok/Instagram/YouTube, Zernio:
// Threads/Facebook Page), not a free choice -- see the per-platform account-id
// columns below, each implicitly tied to whichever provider covers it.
export const schedulerAccounts = pgTable("scheduler_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  // Which Video Library category this account's post queue draws from.
  // Multiple accounts CAN share a category -- claimNextVideos() (see
  // lib/scheduler/videoPool.ts) claims FIFO inside a transaction so the same
  // video is never handed to two accounts.
  category: text("category").notNull(),
  bufferApiKey: text("buffer_api_key"),
  zernioApiKey: text("zernio_api_key"),
  // Connected-channel IDs, obtained from each provider's own dashboard/API --
  // entered manually by the user, same convention as videoStorageAccounts'
  // manual cloudName/apiKey/apiSecret entry.
  tiktokAccountId: text("tiktok_account_id"),
  instagramAccountId: text("instagram_account_id"),
  youtubeAccountId: text("youtube_account_id"),
  threadsAccountId: text("threads_account_id"),
  facebookPageAccountId: text("facebook_page_account_id"),
  // Rotation pattern -- see lib/scheduler/rotation.ts's computeSlotTimes().
  // "HH:mm" strings, editable by the user.
  baseTimes: text("base_times").array().notNull(),
  incrementMinutes: integer("increment_minutes").notNull().default(5),
  // The ceiling the LAST baseTimes entry drifts toward before the whole
  // pattern wraps back to baseTimes -- also "HH:mm".
  capTime: text("cap_time").notNull(),
  // Advances by 1 each time the daily build-schedule cron successfully runs
  // for this account -- NOT derived from calendar-date difference, so a
  // missed cron run doesn't cause the rotation to "jump" to catch up.
  rotationDayIndex: integer("rotation_day_index").notNull().default(0),
  // "YYYY-MM-DD" (Asia/Jakarta) of the last successful build for this
  // account -- guards against building twice for the same day, whether from
  // a duplicate cron invocation or the manual "Jadwalkan Sekarang" button
  // firing after the daily cron already ran. See buildScheduleForAccount()
  // in lib/scheduler/buildSchedule.ts.
  lastBuiltDate: text("last_built_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// One row per queued/posted/failed scheduling attempt -- both the queue the
// dispatch cron drains and the permanent log of what was posted where.
export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  schedulerAccountId: uuid("scheduler_account_id").notNull().references(() => schedulerAccounts.id),
  videoContentId: uuid("video_content_id").notNull().references(() => videoContents.id),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  // Snapshot of which platforms this account had configured at build time --
  // deliberately not re-derived from the account row at dispatch time, so a
  // credential change after the queue was built doesn't retroactively alter
  // an already-queued post's target list.
  platforms: text("platforms").array().notNull(),
  status: text("status").notNull().default("queued"),
  // Per-platform outcome, e.g. {"tiktok":{"ok":true,"postId":"..."},
  // "instagram":{"ok":false,"error":"..."}} -- lets one post row report
  // partial success across its 5 target platforms instead of one flat result.
  providerResults: jsonb("provider_results"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertProductAnalyticsSchema = createInsertSchema(productAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});

export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertContentGenerationSchema = createInsertSchema(contentGenerations).omit({
  id: true,
  createdAt: true,
});

export const insertVideoContentSchema = createInsertSchema(videoContents).omit({
  id: true,
  createdAt: true,
});

export const insertVideoStorageAccountSchema = createInsertSchema(videoStorageAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSchedulerAccountSchema = createInsertSchema(schedulerAccounts).omit({
  id: true,
  rotationDayIndex: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPosts).omit({
  id: true,
  createdAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductAnalytics = typeof productAnalytics.$inferSelect;
export type InsertProductAnalytics = z.infer<typeof insertProductAnalyticsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type ContentGeneration = typeof contentGenerations.$inferSelect;
export type InsertContentGeneration = z.infer<typeof insertContentGenerationSchema>;
export type VideoContent = typeof videoContents.$inferSelect;
export type InsertVideoContent = z.infer<typeof insertVideoContentSchema>;
export type VideoStorageAccount = typeof videoStorageAccounts.$inferSelect;
export type InsertVideoStorageAccount = z.infer<typeof insertVideoStorageAccountSchema>;
export type SchedulerAccount = typeof schedulerAccounts.$inferSelect;
export type InsertSchedulerAccount = z.infer<typeof insertSchedulerAccountSchema>;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
