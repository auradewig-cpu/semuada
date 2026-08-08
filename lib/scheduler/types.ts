// The 5 platforms this feature targets. Provider (Buffer vs Zernio) is
// determined per-platform, not chosen freely -- see lib/scheduler/platforms.ts.
export type SchedulerPlatform = "tiktok" | "instagram" | "youtube" | "threads" | "facebook_page";

export interface PlatformPostResult {
  ok: boolean;
  postId?: string;
  error?: string;
}

// Per-platform outcome of one dispatch attempt -- stored verbatim into
// scheduled_posts.provider_results so a single post row (which can target up
// to 5 platforms) can report partial success/failure per platform.
export type ProviderResults = Partial<Record<SchedulerPlatform, PlatformPostResult>>;
