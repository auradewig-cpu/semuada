import { and, eq, lte } from "drizzle-orm";
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

// Atomically take ownership of the rows this caller is about to dispatch, by
// flipping them out of "queued" in the same statement that reads them.
//
// Selecting rows and only writing their status back AFTER the provider call
// returns leaves a window in which a second caller sees the same "queued" rows
// and posts them again. That window is real: the dispatch poller fires every
// 10 minutes with no concurrency guard and drains backlogs sequentially with a
// full video upload per post, and the daily cron and the manual "Jadwalkan &
// Post Sekarang" button can overlap. Duplicate posts on nine real social
// accounts is the 2026-08-09 incident.
//
// Single-statement UPDATE ... RETURNING is atomic in Postgres, which is what
// this project's neon-http driver offers instead of multi-statement
// transactions -- the same reasoning as claimNextVideos() in ./videoPool.
//
// A row left at "dispatching" (the function died mid-flight) is deliberately
// never reclaimed automatically: the provider may already have accepted it.
// Those surface in the admin UI to be judged by a human.
export function claimDuePosts(now: Date) {
  return db
    .update(scheduledPosts)
    .set({ status: "dispatching" })
    .where(and(eq(scheduledPosts.status, "queued"), lte(scheduledPosts.scheduledFor, now)))
    .returning();
}

export function claimQueuedPostsForAccount(accountId: string) {
  return db
    .update(scheduledPosts)
    .set({ status: "dispatching" })
    .where(and(eq(scheduledPosts.schedulerAccountId, accountId), eq(scheduledPosts.status, "queued")))
    .returning();
}

// What a set of per-platform results means for the row and its video.
// Extracted so the rules can be exercised directly (see
// scripts/verify-scheduler-dispatch.ts) instead of only through a live
// dispatch that would really post to nine social accounts.
//
// - `status`: "posted" the moment ANY platform succeeded, so a row can be
//   posted while some of its platforms are still failed -- that detail lives
//   in provider_results for the UI, not in the top-level status.
// - Zero outcomes is FAILURE, not success. It used to fall through to
//   "posted" via an `outcomes.length > 0` guard, which is how a post
//   targeting no platforms at all got a green tick without a single provider
//   being contacted.
// - `releaseVideo`: put the video back in the pool only when nothing
//   succeeded AND no platform recorded a postId. A stored postId means a
//   provider may have accepted the post despite the error on our side, and
//   re-queuing the video would publish it twice.
export function resolveDispatchOutcome(providerResults: ProviderResults): {
  status: "posted" | "failed";
  anySucceeded: boolean;
  releaseVideo: boolean;
  errorMessage: string | null;
} {
  const outcomes = Object.values(providerResults);
  const anySucceeded = outcomes.some((r) => r.ok);
  const allFailed = outcomes.every((r) => !r.ok);
  return {
    status: allFailed ? "failed" : "posted",
    anySucceeded,
    releaseVideo: allFailed && outcomes.every((r) => !r.postId),
    errorMessage: allFailed
      ? outcomes.map((r) => r.error).filter(Boolean).join("; ") || "Tidak ada platform yang dituju."
      : null,
  };
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
  const outcome = resolveDispatchOutcome(providerResults);

  await db
    .update(scheduledPosts)
    .set({
      status: outcome.status,
      providerResults,
      postedAt: outcome.anySucceeded ? (post.postedAt ?? new Date()) : null,
      errorMessage: outcome.errorMessage,
    })
    .where(eq(scheduledPosts.id, post.id));

  if (outcome.anySucceeded) {
    await db.update(videoContents).set({ status: "posted", trashedAt: new Date() }).where(eq(videoContents.id, video.id));
    return;
  }

  // Nothing succeeded. The video was claimed out of the pool at build time
  // (status 'scheduled') and, without this, stays there forever:
  // claimNextVideos() only ever takes 'uploaded' rows, and nothing trashed it
  // either -- so it is invisible in both the pool and the trash, recoverable
  // only by hand. One bad night (Cloudinary down, an expired key) would strand
  // one video per account at once.
  //
  // The status guard in the WHERE keeps this from resurrecting a video that
  // something else has since moved on.
  if (outcome.releaseVideo) {
    await db
      .update(videoContents)
      .set({ status: "uploaded" })
      .where(and(eq(videoContents.id, video.id), eq(videoContents.status, "scheduled")));
  }
}
