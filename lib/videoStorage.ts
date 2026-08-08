import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@root/lib/db";
import { videoStorageAccounts, type VideoContent } from "@shared/schema";

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

// Extracted from the video-content DELETE route so the trash-purge cron can
// destroy the same Cloudinary asset without duplicating the lookup/destroy
// logic. Best-effort by design (never throws) -- both call sites (a manual
// delete, or an automated 30-day purge) should still remove the DB row even
// if the remote asset is already gone or the request times out.
export async function destroyVideoAsset(video: Pick<VideoContent, "storageAccountId" | "cloudinaryPublicId">): Promise<void> {
  if (!video.storageAccountId) return;
  try {
    const [account] = await db.select().from(videoStorageAccounts).where(eq(videoStorageAccounts.id, video.storageAccountId));
    if (!account) return;
    // Credentials passed per-call (not a global .config() mutation) since
    // Vercel's Fluid Compute can reuse a warm instance across concurrent
    // requests for different accounts -- see the DELETE route this was
    // extracted from for the original rationale.
    await cloudinary.uploader.destroy(video.cloudinaryPublicId, {
      resource_type: "video",
      cloud_name: account.cloudName,
      api_key: account.apiKey,
      api_secret: account.apiSecret,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch {
    // ignore -- best-effort cleanup
  }
}
