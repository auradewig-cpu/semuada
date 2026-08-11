import { useQuery } from "@tanstack/react-query";

export type MetricsPeriod = "7d" | "30d" | "90d" | "all";

/**
 * One row per (post, platform), already reduced to that pair's LATEST daily
 * snapshot server-side -- see app/api/scheduler-metrics/route.ts for why
 * summing the raw table would double-count.
 *
 * A null metric means the provider does not report it for that platform
 * (TikTok has no saves/clicks/follows, YouTube no reach/shares, Instagram no
 * impressions/clicks). Render those as "—", never as 0.
 */
export interface SocialMetricRow {
  account_id: string;
  account_label: string;
  account_active: boolean;
  category: string;
  post_id: string;
  posted_at: string | null;
  video_id: string;
  video_caption: string | null;
  video_category: string;
  video_subcategory: string | null;
  platform: string;
  captured_on: string | null;
  views: number | null;
  impressions: number | null;
  reach: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  follows: number | null;
  engagement_rate: number | null;
}

/** Every scheduler account, including ones with no metrics yet. */
export interface SocialAccount {
  id: string;
  label: string;
  category: string;
  is_active: boolean;
  /** Platforms this account is currently wired up to. A platform with metrics
   *  but missing here was disconnected after posting -- worth flagging, not
   *  hiding. */
  platforms: string[];
  posts_published: number;
}

/**
 * Publish outcome per (account, platform) -- separates "never went out" from
 * "went out to nobody". Both read as zero views otherwise, and they call for
 * opposite responses.
 */
export interface PublishingRow {
  account_id: string;
  platform: string;
  targeted: number;
  published: number;
  failed: number;
  pending: number;
}

export interface SocialMetricsResponse {
  items: SocialMetricRow[];
  accounts: SocialAccount[];
  publishing: PublishingRow[];
  coverage: {
    first_captured_on: string | null;
    last_captured_on: string | null;
    distinct_days: number;
  };
}

export function useSchedulerMetrics(period: MetricsPeriod) {
  return useQuery<SocialMetricsResponse>({
    queryKey: ["schedulerMetrics", period],
    queryFn: async () => {
      const res = await fetch(`/api/scheduler-metrics?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
