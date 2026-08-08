import type { SchedulerAccount } from "@shared/schema";
import type { SchedulerPlatform } from "./types";

// Platform-to-provider is fixed by which free-tier connections the user
// actually has -- Buffer covers TikTok/Instagram/YouTube, Zernio covers
// Threads/Facebook Page. This isn't a per-account choice, it's a fact about
// which provider each platform's account-id column belongs to.
export const BUFFER_PLATFORMS: SchedulerPlatform[] = ["tiktok", "instagram", "youtube"];
export const ZERNIO_PLATFORMS: SchedulerPlatform[] = ["threads", "facebook_page"];

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
