import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts, videoContents, type ScheduledPost } from "@shared/schema";
import { postToBuffer } from "./providers/buffer";
import { postToZernio } from "./providers/zernio";
import { BUFFER_PLATFORMS, ZERNIO_PLATFORMS } from "./platforms";
import type { SchedulerPlatform, ProviderResults } from "./types";

// Publishes one due scheduled_posts row: splits its target platforms between
// Buffer and Zernio (fixed mapping, see platforms.ts), calls both providers
// in parallel, merges per-platform results, and moves the underlying video to
// trash the moment at least one platform actually succeeded -- matching the
// "video yang berhasil diupload masuk sampah" requirement. A row can be
// "posted" with some platforms still failed; that detail lives in
// provider_results for the admin UI to surface, not in the top-level status.
export async function dispatchScheduledPost(post: ScheduledPost): Promise<void> {
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, post.schedulerAccountId));
  const [video] = await db.select().from(videoContents).where(eq(videoContents.id, post.videoContentId));

  if (!account || !video) {
    await db
      .update(scheduledPosts)
      .set({ status: "failed", errorMessage: "Akun scheduler atau video sudah tidak ada." })
      .where(eq(scheduledPosts.id, post.id));
    return;
  }

  const platforms = post.platforms as SchedulerPlatform[];
  const bufferPlatforms = platforms.filter((p) => BUFFER_PLATFORMS.includes(p));
  const zernioPlatforms = platforms.filter((p) => ZERNIO_PLATFORMS.includes(p));

  const [bufferResults, zernioResults] = await Promise.all([
    bufferPlatforms.length > 0 ? postToBuffer(account, video, bufferPlatforms) : Promise.resolve<ProviderResults>({}),
    zernioPlatforms.length > 0 ? postToZernio(account, video, zernioPlatforms) : Promise.resolve<ProviderResults>({}),
  ]);

  const providerResults: ProviderResults = { ...bufferResults, ...zernioResults };
  const outcomes = Object.values(providerResults);
  const anySucceeded = outcomes.some((r) => r.ok);
  const allFailed = outcomes.length > 0 && outcomes.every((r) => !r.ok);

  await db
    .update(scheduledPosts)
    .set({
      status: allFailed ? "failed" : "posted",
      providerResults,
      postedAt: anySucceeded ? new Date() : null,
      errorMessage: allFailed ? outcomes.map((r) => r.error).filter(Boolean).join("; ") : null,
    })
    .where(eq(scheduledPosts.id, post.id));

  if (anySucceeded) {
    await db.update(videoContents).set({ status: "posted", trashedAt: new Date() }).where(eq(videoContents.id, video.id));
  }
}
