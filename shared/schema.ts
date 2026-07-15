import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contentGenerations = pgTable("content_generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull(),
  characterId: uuid("character_id"),
  style: text("style").notNull(),
  output: text("output").notNull(),
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
