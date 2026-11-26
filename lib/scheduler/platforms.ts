import type { SchedulerAccount } from "@shared/schema";
import type { SchedulerPlatform } from "./types";

// Platform-to-provider is fixed by which free-tier connections the user
// actually has -- Buffer covers TikTok/Instagram/YouTube, Zernio covers
// Threads/Facebook Page. This isn't a per-account choice, it's a fact about
// which provider each platform's account-id column belongs to.
export const BUFFER_PLATFORMS: SchedulerPlatform[] = ["tiktok", "instagram", "youtube"];
export const ZERNIO_PLATFORMS: SchedulerPlatform[] = ["threads", "facebook_page"];

// The most posts a platform accepts per channel per day, where that is below
// what an account may post. Measured, not documented: after the move to
// 5 posts/day every YouTube channel landed exactly 2 a day (2026-11-18..26:
// Alya 18/45 over 9 days, Keisha 16/40 over 8, Melisani 12/27 over 6) and the
// rest bounced with "You have already scheduled the maximum number of posts
// YouTube allows in a day (2)" or "The daily posting limit for this channel
// has been reached". Posts beyond the cap are simply built without that
// platform -- see buildScheduleForAccount().
export const PLATFORM_DAILY_CAP: Partial<Record<SchedulerPlatform, number>> = {
  youtube: 2,
};

export const ACCOUNT_ID_FIELD: Record<SchedulerPlatform, keyof SchedulerAccount> = {
  tiktok: "tiktokAccountId",
  instagram: "instagramAccountId",
  youtube: "youtubeAccountId",
  threads: "threadsAccountId",
  facebook_page: "facebookPageAccountId",
};

// Which of the 5 platforms this account actually has a connected channel ID
// for -- used at queue-build time to snapshot the target list per
// scheduled_posts row (see the schema comment on scheduledPosts.platforms
// for why it's a snapshot rather than re-derived at dispatch time).
export function resolveConfiguredPlatforms(account: SchedulerAccount): SchedulerPlatform[] {
  return (Object.keys(ACCOUNT_ID_FIELD) as SchedulerPlatform[]).filter((p) => Boolean(account[ACCOUNT_ID_FIELD[p]]));
}
