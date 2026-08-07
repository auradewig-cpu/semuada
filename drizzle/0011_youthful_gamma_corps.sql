CREATE TABLE "video_storage_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"cloud_name" text NOT NULL,
	"api_key" text NOT NULL,
	"api_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "video_storage_accounts_category_unique" UNIQUE("category")
);
--> statement-breakpoint
ALTER TABLE "video_contents" ADD COLUMN "storage_account_id" uuid;--> statement-breakpoint
ALTER TABLE "video_contents" ADD CONSTRAINT "video_contents_storage_account_id_video_storage_accounts_id_fk" FOREIGN KEY ("storage_account_id") REFERENCES "public"."video_storage_accounts"("id") ON DELETE no action ON UPDATE no action;