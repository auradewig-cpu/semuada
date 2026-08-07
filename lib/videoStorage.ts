import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoStorageAccounts } from "@shared/schema";

// Every category without its own Cloudinary account falls back to this one
// -- the account already live in production before multi-account storage
// existed, so every video uploaded so far already lives here regardless of
// its own category (see the one-off backfill run at rollout time).
const FALLBACK_CATEGORY = "Perawatan & Kecantikan";

export async function resolveStorageAccount(category: string) {
  const [dedicated] = await db
    .select()
    .from(videoStorageAccounts)
    .where(eq(videoStorageAccounts.category, category));
  if (dedicated) return dedicated;

  const [fallback] = await db
    .select()
    .from(videoStorageAccounts)
    .where(eq(videoStorageAccounts.category, FALLBACK_CATEGORY));
  return fallback ?? null;
}
