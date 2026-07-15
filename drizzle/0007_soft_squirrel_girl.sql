ALTER TABLE "ai_settings" ALTER COLUMN "gemini_model" SET DEFAULT 'gemini-flash-latest';--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "narration_wpm" integer DEFAULT 180;