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

// One provider's performance numbers for a single published post. Every
// metric is optional because coverage genuinely varies -- per network (only
// Instagram reports `saves`/`follows`, TikTok has no `saves`), per provider,
// and over time (Buffer returns no metrics at all until its once-daily
// ingestion job has processed a post). `undefined` therefore means "not
// reported", which is deliberately distinct from a reported 0.
export interface MetricsSnapshot {
  views?: number;
  impressions?: number;
  reach?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  follows?: number;
  engagementRate?: number;
  // When the provider itself last refreshed these numbers (Buffer exposes
  // this; Zernio reports a per-post `lastUpdated`). Lets a stale value be
  // told apart from a genuinely flat one.
  providerUpdatedAt?: Date;
  // Anything the provider returned that the fields above don't cover.
  raw?: Record<string, unknown>;
}

// What the provider says actually happened to a post after we handed it
// over. This matters because a successful dispatch only means the provider
// ACCEPTED the post into its queue -- publishing happens later and can still
// fail (lost channel authorization, a network blip on the provider's side,
// the network rejecting the upload). Without reading this back, such failures
// are invisible to us and the post shows a permanent green checkmark.
export interface ProviderPostState {
  // Buffer's PostStatus enum: draft | error | needs_approval | scheduled |
  // sending | sent. "scheduled"/"sending" are healthy in-flight states, NOT
  // failures -- posts handed over with a future scheduledAt sit there until
  // their slot arrives.
  status: string;
  errorMessage?: string;
  sentAt?: Date;
}

// Keyed by the provider's own post id -- the same id stored in
// scheduled_posts.provider_results[platform].postId at dispatch time, which
// is what lets the sync job match a provider's data back to our row.
// `metrics` is null until the provider has ingested numbers for the post.
export type ProviderPostsById = Map<string, { metrics: MetricsSnapshot | null; state: ProviderPostState }>;

export type MetricsByPostId = Map<string, MetricsSnapshot>;
