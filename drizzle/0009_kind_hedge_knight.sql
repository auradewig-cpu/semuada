CREATE TABLE "video_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"caption" text,
	"hashtags" text[],
	"prompt_snapshot" text,
	"video_url" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"status" text DEFAULT 'uploaded',
	"created_at" timestamp with time zone DEFAULT now()
);
