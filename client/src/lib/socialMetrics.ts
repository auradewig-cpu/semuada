import type { SocialMetricRow } from "@/hooks/useSchedulerMetrics";

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  threads: "Threads",
  facebook_page: "Facebook Page",
};

/** Fixed display order, so columns and rows never reshuffle between renders. */
export const PLATFORM_ORDER = ["tiktok", "instagram", "youtube", "threads", "facebook_page"];

export type MetricKey =
  | "views" | "impressions" | "reach"
  | "reactions" | "comments" | "shares" | "saves"
  | "clicks" | "follows" | "engagement_rate";

/**
 * Which metrics each provider actually reports, established by counting
 * non-null values per platform in the real post_metrics table rather than
 * from documentation. Anything outside a platform's list arrives as NULL
 * forever, so the UI shows an em dash instead of a 0 that would read as
 * "nobody did it" rather than "this cannot be measured".
 */
export const PLATFORM_COVERAGE: Record<string, MetricKey[]> = {
  tiktok: ["views", "reach", "reactions", "comments", "shares", "engagement_rate"],
  instagram: ["views", "reach", "reactions", "comments", "shares", "saves", "follows", "engagement_rate"],
  youtube: ["views", "reactions", "comments", "engagement_rate"],
  threads: ["views", "impressions", "reach", "reactions", "comments", "shares", "saves", "clicks", "follows", "engagement_rate"],
  facebook_page: ["views", "impressions", "reach", "reactions", "comments", "shares", "saves", "clicks", "follows", "engagement_rate"],
};

export function platformReports(platform: string, metric: MetricKey): boolean {
  const covered = PLATFORM_COVERAGE[platform];
  return !covered || covered.includes(metric);
}

export type MetricGroupId = "jangkauan" | "interaksi" | "aksi";

export interface MetricColumn {
  /** `views_per_post` and `engagement_rate` are computed, the rest are sums. */
  key: MetricKey | "views_per_post";
  label: string;
}

/**
 * Metrics are grouped rather than listed as one long row of columns. Today
 * only the reach family has data at all -- comments, shares, saves, clicks
 * and follows are zero across every row in the table -- so a single flat
 * table would be mostly empty. Grouping keeps it readable now and lets the
 * other families become useful later without a redesign.
 */
export const METRIC_GROUPS: Record<MetricGroupId, { label: string; columns: MetricColumn[] }> = {
  jangkauan: {
    label: "Jangkauan",
    columns: [
      { key: "views", label: "Views" },
      // Raw totals conflate "posts a lot" with "performs well": TikTok has the
      // most posts and the least reach. Per-post is what makes that visible.
      { key: "views_per_post", label: "Views/post" },
      { key: "reach", label: "Reach" },
      { key: "impressions", label: "Impressions" },
    ],
  },
  interaksi: {
    label: "Interaksi",
    columns: [
      { key: "reactions", label: "Like" },
      { key: "comments", label: "Komentar" },
      { key: "shares", label: "Share" },
      { key: "saves", label: "Save" },
      { key: "engagement_rate", label: "ER" },
    ],
  },
  aksi: {
    label: "Aksi",
    columns: [
      { key: "clicks", label: "Klik" },
      { key: "follows", label: "Follow" },
    ],
  },
};

/** Sum that stays null when nothing in the group reported the metric at all. */
export function sumOrNull(rows: SocialMetricRow[], key: MetricKey): number | null {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    const value = row[key];
    if (typeof value === "number") {
      total += value;
      seen = true;
    }
  }
  return seen ? total : null;
}

/** Reactions + comments + shares + saves -- interactions, minus passive views. */
export function engagementOf(row: SocialMetricRow): number {
  return (row.reactions ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0);
}

/**
 * The value behind one column for a set of rows. Returns null for "no data",
 * which the caller renders distinctly from a real zero.
 */
export function columnValue(rows: SocialMetricRow[], column: MetricColumn): number | null {
  if (column.key === "views_per_post") {
    const views = sumOrNull(rows, "views");
    if (views === null || rows.length === 0) return null;
    return views / rows.length;
  }
  if (column.key === "engagement_rate") {
    // Averaged rather than summed -- a rate has no meaning added together.
    const rates = rows.map((r) => r.engagement_rate).filter((v): v is number => typeof v === "number");
    if (rates.length === 0) return null;
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }
  return sumOrNull(rows, column.key);
}

export function formatColumn(value: number | null, column: MetricColumn): string {
  if (value === null) return "—";
  if (column.key === "engagement_rate") return `${value.toFixed(2)}%`;
  if (column.key === "views_per_post") return value.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return value.toLocaleString("id-ID");
}

export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("id-ID");
}
