import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts, videoContents, type ScheduledPost } from "@shared/schema";
import { postToBuffer } from "./providers/buffer";
import { postToZernio } from "./providers/zernio";
import { BUFFER_PLATFORMS, ZERNIO_PLATFORMS } from "./platforms";
import type { SchedulerPlatform, ProviderResults } from "./types";

// Which platforms on this post still need a (re)dispatch attempt -- anything
// without a recorded ok:true result. Used both for the initial dispatch (no
// providerResults yet, so this is just post.platforms) and for retrying a
// PARTIALLY successful post: a post can be "posted" overall (>=1 platform
// succeeded) while some of its platforms are still failed, and those must be
// retried WITHOUT re-sending to the platforms that already succeeded (that
// would duplicate-post there). See the retry route for the other half of
// this.
export function platformsNeedingDispatch(post: ScheduledPost): SchedulerPlatform[] {
  const results = (post.providerResults as ProviderResults | null) ?? {};
  return (post.platforms as SchedulerPlatform[]).filter((p) => results[p]?.ok !== true);
}

// Publishes one scheduled_posts row: splits its target platforms between
// Buffer and Zernio (fixed mapping, see platforms.ts), calls both providers
// in parallel, merges per-platform results into whatever was already
// recorded (so retrying a partial failure doesn't erase earlier successes),
// and moves the underlying video to trash the moment at least one platform
// has ever succeeded -- matching the "video yang berhasil diupload masuk
// sampah" requirement. A row can be "posted" with some platforms still
// failed; that detail lives in provider_results for the admin UI to surface,
// not in the top-level status.
//
// options.platforms: restricts which platforms actually get (re)dispatched
// this call -- defaults to platformsNeedingDispatch(post) so a bare retry
// only touches platforms that haven't already succeeded. The retry route
// passes this explicitly for clarity; cron/build-now/manual-trigger callers
// leave it unset since they only ever call this on freshly-"queued" posts
// (no prior providerResults, so the default already covers all platforms).
//
// options.scheduledAt: when set, providers are told to schedule the post for
// that exact time on THEIR side (Buffer/Zernio own the publish-moment
// precision) instead of publishing immediately. The daily 01:00 auto-build
// (build-schedule cron) passes each post's own scheduledFor here; the manual
// "Jadwalkan & Post Sekarang" button and the dispatch-posts safety-net poller
// omit it, so they keep publishing immediately as before. "posted" status
// therefore means "handed off successfully" either way -- for a scheduled
// hand-off the video is trashed right away too, since our system's job is
// done once Buffer/Zernio have accepted it.
export async function dispatchScheduledPost(post: ScheduledPost, options?: { scheduledAt?: Date; platforms?: SchedulerPlatform[] }): Promise<void> {
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, post.schedulerAccountId));
  const [video] = await db.select().from(videoContents).where(eq(videoContents.id, post.videoContentId));

  if (!account || !video) {
    await db
      .update(scheduledPosts)
      .set({ status: "failed", errorMessage: "Akun scheduler atau video sudah tidak ada." })
      .where(eq(scheduledPosts.id, post.id));
    return;
  }

  const targetPlatforms = options?.platforms ?? platformsNeedingDispatch(post);
  const bufferPlatforms = targetPlatforms.filter((p) => BUFFER_PLATFORMS.includes(p));
  const zernioPlatforms = targetPlatforms.filter((p) => ZERNIO_PLATFORMS.includes(p));

  const [bufferResults, zernioResults] = await Promise.all([
    bufferPlatforms.length > 0 ? postToBuffer(account, video, bufferPlatforms, options?.scheduledAt) : Promise.resolve<ProviderResults>({}),
    zernioPlatforms.length > 0 ? postToZernio(account, video, zernioPlatforms, options?.scheduledAt) : Promise.resolve<ProviderResults>({}),
  ]);

  const previousResults = (post.providerResults as ProviderResults | null) ?? {};
  const providerResults: ProviderResults = { ...previousResults, ...bufferResults, ...zernioResults };
  const outcomes = Object.values(providerResults);
  const anySucceeded = outcomes.some((r) => r.ok);
  const allFailed = outcomes.length > 0 && outcomes.every((r) => !r.ok);

  await db
    .update(scheduledPosts)
    .set({
      status: allFailed ? "failed" : "posted",
      providerResults,
      postedAt: anySucceeded ? (post.postedAt ?? new Date()) : null,
      errorMessage: allFailed ? outcomes.map((r) => r.error).filter(Boolean).join("; ") : null,
    })
    .where(eq(scheduledPosts.id, post.id));

  if (anySucceeded) {
    await db.update(videoContents).set({ status: "posted", trashedAt: new Date() }).where(eq(videoContents.id, video.id));
  }
}
