CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gemini_api_key" text,
	"gemini_model" text DEFAULT 'gemini-2.5-flash',
	"groq_api_key" text,
	"openrouter_api_key" text,
	"deepseek_api_key" text,
	"provider_order" text[] DEFAULT ARRAY['gemini','groq','openrouter','deepseek'],
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"photo_url" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"character_id" uuid,
	"style" text NOT NULL,
	"output" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
