ALTER TABLE "settings" ADD COLUMN "site_name" text DEFAULT 'SEMUADA';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "site_tagline" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "favicon_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contact_address" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "social_facebook_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "social_twitter_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "social_instagram_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "seo_meta_description" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "og_image_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "maintenance_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "maintenance_message" text;