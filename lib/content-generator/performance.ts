// Learning (Phase 5) -- READ-ONLY. Turns the post_metrics time series into
// relative performance signals per creative fingerprint dimension, traced
// through the FK (video_contents.content_generation_id) added in Phase 0 --
// NOT caption matching, which silently misattributes ~15% of videos.
//
// Normalization is mandatory: accounts differ in followers and platform mix
// (the three Kecantikan accounts even lack YouTube, which averages 512
// views/post here vs Instagram 91 and TikTok 21), so every post is compared
// against the MEDIAN of its own account+platform, not raw numbers. Follower
// counts aren't stored, so the internal baseline is the only honest yardstick.
//
// The output is recommendations, never actions: exploration/exploitation stays
// off until the sample sizes look sane (n < 10 is flagged, not served as fact).

import { eq, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { contentGenerations, postMetrics, scheduledPosts, videoContents } from "@shared/schema";

export interface DimensionStat {
  dimension: string;
  value: string;
  n: number;
  /** Mean views relative to the account+platform median (1.0 = at baseline). */
  relativeViews: number;
  /** Per-category relative views, keyed by category name. */
  byCategory: { category: string; relativeViews: number; n: number }[];
}

export interface PerformanceReport {
  untrackedVideos: number;
  trackedPosts: number;
  dimensions: { mechanism: DimensionStat[]; style: DimensionStat[]; hook: DimensionStat[]; realism: DimensionStat[] };
  recommendations: string[];
}

interface MetricRow {
  views: number | null;
  platform: string | null;
  schedulerAccountId: string | null;
  category: string | null;
  mechanism: string | null;
  style: string | null;
  hook: string | null;
  realism: string | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildStat(values: { category: string | null; relative: number }[], dimension: string, value: string): DimensionStat {
  const rel = values.map((v) => v.relative);
  const byCategory = new Map<string, { sum: number; n: number }>();
  for (const v of values) {
    if (!v.category) continue;
    const cur = byCategory.get(v.category) ?? { sum: 0, n: 0 };
    cur.sum += v.relative;
    cur.n += 1;
    byCategory.set(v.category, cur);
  }
  return {
    dimension,
    value,
    n: rel.length,
    relativeViews: rel.length ? rel.reduce((a, b) => a + b, 0) / rel.length : 0,
    byCategory: Array.from(byCategory.entries())
      .map(([category, c]) => ({ category, relativeViews: c.sum / c.n, n: c.n }))
      .sort((a, b) => b.relativeViews - a.relativeViews),
  };
}

interface EnrichedRow {
  category: string | null;
  mechanism: string | null;
  style: string | null;
  hook: string | null;
  realism: string | null;
  relative: number;
}

function groupStats(rows: EnrichedRow[], pick: (r: EnrichedRow) => string | null, dimension: string): DimensionStat[] {
  const byValue = new Map<string, { category: string | null; relative: number }[]>();
  for (const r of rows) {
    const value = pick(r);
    if (!value) continue;
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value)!.push({ category: r.category, relative: r.relative });
  }
  return Array.from(byValue.entries())
    .map(([value, list]) => buildStat(list, dimension, value))
    .sort((a, b) => b.relativeViews - a.relativeViews);
}

export async function buildPerformanceReport(): Promise<PerformanceReport> {
  // Baseline = median views per (account, platform). Only post rows that carry
  // views and trace back to a generation (via the FK) participate.
  const rows = (await db
    .select({
      views: postMetrics.views,
      platform: postMetrics.platform,
      schedulerAccountId: scheduledPosts.schedulerAccountId,
      category: videoContents.category,
      mechanism: contentGenerations.mechanism,
      style: contentGenerations.style,
      hook: contentGenerations.hookArchetype,
      realism: contentGenerations.realismProfile,
    })
    .from(postMetrics)
    .innerJoin(scheduledPosts, eq(postMetrics.scheduledPostId, scheduledPosts.id))
    .innerJoin(videoContents, eq(scheduledPosts.videoContentId, videoContents.id))
    .innerJoin(contentGenerations, eq(videoContents.contentGenerationId, contentGenerations.id))) as MetricRow[];

  const usable = rows.filter((r) => r.views !== null && r.schedulerAccountId !== null && r.platform !== null);

  // Per-account+platform medians.
  const buckets = new Map<string, number[]>();
  for (const r of usable) {
    const key = `${r.schedulerAccountId}|${r.platform}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r.views!);
  }
  const baselines = new Map<string, number>();
  for (const [key, vals] of buckets) baselines.set(key, median(vals));

  // Map each row to its normalized (relative-to-baseline) form.
  const enriched: EnrichedRow[] = usable.map((r) => {
    const baseline = baselines.get(`${r.schedulerAccountId}|${r.platform}`) ?? 0;
    const relative = baseline > 0 ? r.views! / baseline : 1;
    return { category: r.category, mechanism: r.mechanism, style: r.style, hook: r.hook, realism: r.realism, relative };
  });

  const dimensions = {
    mechanism: groupStats(enriched, (e) => e.mechanism, "mechanism"),
    style: groupStats(enriched, (e) => e.style, "style"),
    hook: groupStats(enriched, (e) => e.hook, "hook"),
    realism: groupStats(enriched, (e) => e.realism, "realism"),
  };

  // Recommendations: per category, dimensions with n >= 10 clearly above baseline.
  const recommendations: string[] = [];
  const collect = (stats: DimensionStat[], label: string) => {
    for (const s of stats) {
      for (const c of s.byCategory) {
        if (c.n >= 10 && c.relativeViews > 1.15) {
          recommendations.push(`Untuk kategori "${c.category}", ${label} "${s.value}" berada di atas baseline akun ini (${(c.relativeViews * 100).toFixed(0)}%, n=${c.n}).`);
        }
      }
    }
  };
  collect(dimensions.mechanism, "mechanism");
  collect(dimensions.style, "gaya video");
  collect(dimensions.hook, "hook");
  collect(dimensions.realism, "profil realisme");

  // Untracked: videos with no FK that still got posted (traced via scheduled_posts).
  const [untrackedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(videoContents)
    .innerJoin(scheduledPosts, eq(scheduledPosts.videoContentId, videoContents.id))
    .where(sql`${videoContents.contentGenerationId} is null`);

  return {
    untrackedVideos: Number(untrackedRow?.count ?? 0),
    trackedPosts: usable.length,
    dimensions,
    recommendations,
  };
}
