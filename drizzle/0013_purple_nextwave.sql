-- Storefront read indexes for `products`. Before these the table carried
-- nothing but its primary key, so every category grid, featured carousel and
-- options lookup was a sequential scan plus a sort.
--
-- Trimmed by hand: `drizzle-kit generate` also wanted to emit CREATE TABLE for
-- scheduled_posts / scheduler_accounts / post_metrics and the video_contents
-- trashed_at/purged_at columns. Those already exist in the database -- they
-- were applied with `drizzle-kit push`, which syncs the schema without writing
-- a migration file, so the snapshots had drifted behind reality. Re-emitting
-- them here would just fail with "already exists". The 0013 snapshot DOES
-- record them, so future `generate` runs start from a truthful baseline.
--
-- Apply with `drizzle-kit push` or by running this file directly. NOT with
-- `drizzle-kit migrate`: drizzle.__drizzle_migrations is empty on this
-- database, so migrate would try to replay 0000 onward against a schema that
-- already exists.
CREATE INDEX IF NOT EXISTS "products_category_created_at_idx" ON "products" USING btree ("category","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_subcategory_created_at_idx" ON "products" USING btree ("category","subcategory","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_created_at_idx" ON "products" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_featured_order_idx" ON "products" USING btree ("is_featured","featured_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_dikirim_dari_idx" ON "products" USING btree ("dikirim_dari");
