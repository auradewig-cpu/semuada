import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { requireAuth } from "@root/lib/apiAuth";

// Social post performance, aggregated for the admin Dashboard tab.
//
// THE TRAP THIS ROUTE EXISTS TO AVOID: post_metrics is a TIME SERIES -- one
// snapshot per (scheduled_post, platform, day), written by the daily sync in
// lib/scheduler/metrics.ts. Provider counters are cumulative, so a post with
// 200 views on day 1 and 260 on day 2 has two rows, 200 and 260. SUM()ing the
// column would report 460 views for a post that got 260. Every aggregate here
// therefore reduces to the LATEST snapshot per (post, platform) first, via
// DISTINCT ON, and only then sums across posts.
//
// Not every provider reports every column: TikTok has no saves/clicks/follows,
// YouTube has no reach/shares, Instagram has no impressions/clicks. Those
// arrive as NULL and stay NULL -- the UI shows an em dash rather than a
// misleading zero, so "no data" and "genuinely zero" stay distinguishable.

const PERIOD_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const periodParam = request.nextUrl.searchParams.get("period") ?? "all";
  const days = periodParam in PERIOD_DAYS ? PERIOD_DAYS[periodParam] : null;

  // The window filters on when the post went OUT, not on when a metric was
  // captured: we always want each post's newest numbers, we're only choosing
  // which posts are in scope.
  const since = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (pm.scheduled_post_id, pm.platform)
        pm.scheduled_post_id,
        pm.platform,
        pm.captured_on,
        pm.views, pm.impressions, pm.reach, pm.reactions, pm.comments,
        pm.shares, pm.saves, pm.clicks, pm.follows, pm.engagement_rate
      FROM post_metrics pm
      ORDER BY pm.scheduled_post_id, pm.platform, pm.captured_on DESC
    )
    SELECT
      sa.id            AS account_id,
      sa.label         AS account_label,
      sa.category      AS category,
      sa.is_active     AS account_active,
      sp.id            AS post_id,
      COALESCE(sp.posted_at, sp.scheduled_for) AS posted_at,
      vc.id            AS video_id,
      vc.caption       AS video_caption,
      vc.category      AS video_category,
      vc.subcategory   AS video_subcategory,
      l.platform, l.captured_on,
      l.views, l.impressions, l.reach, l.reactions, l.comments,
      l.shares, l.saves, l.clicks, l.follows, l.engagement_rate
    FROM latest l
    JOIN scheduled_posts sp   ON sp.id = l.scheduled_post_id
    JOIN scheduler_accounts sa ON sa.id = sp.scheduler_account_id
    JOIN video_contents vc     ON vc.id = sp.video_content_id
    ${since ? sql`WHERE COALESCE(sp.posted_at, sp.scheduled_for) >= ${since.toISOString()}` : sql``}
    ORDER BY COALESCE(sp.posted_at, sp.scheduled_for) DESC, sa.label, l.platform
  `);

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  // neon-http hands `timestamp` columns back as Date objects and `date`
  // columns as strings, so normalise both rather than assuming either.
  const isoDate = (v: unknown) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const dayOnly = (v: unknown) => isoDate(v)?.slice(0, 10) ?? null;

  const items = (result.rows as Record<string, unknown>[]).map((r) => ({
    account_id: r.account_id as string,
    account_label: r.account_label as string,
    account_active: r.account_active as boolean,
    category: r.category as string,
    post_id: r.post_id as string,
    posted_at: isoDate(r.posted_at),
    video_id: r.video_id as string,
    video_caption: (r.video_caption as string | null) ?? null,
    video_category: r.video_category as string,
    video_subcategory: (r.video_subcategory as string | null) ?? null,
    platform: r.platform as string,
    captured_on: dayOnly(r.captured_on),
    views: num(r.views),
    impressions: num(r.impressions),
    reach: num(r.reach),
    reactions: num(r.reactions),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saves),
    clicks: num(r.clicks),
    follows: num(r.follows),
    engagement_rate: num(r.engagement_rate),
  }));

  // Every account, including ones with no metrics yet -- the dashboard is
  // meant to answer "how is each account in each category doing", and an
  // account that has published nothing (or whose first post predates the last
  // sync) is an answer, not a row to omit. Driving the UI off `items` alone
  // silently hid 5 of 8 accounts.
  const accountRows = await db.execute(sql`
    SELECT
      sa.id, sa.label, sa.category, sa.is_active,
      COUNT(sp.id) FILTER (
        WHERE sp.status = 'posted'
        ${since ? sql`AND COALESCE(sp.posted_at, sp.scheduled_for) >= ${since.toISOString()}` : sql``}
      )::int AS posts_published
    FROM scheduler_accounts sa
    LEFT JOIN scheduled_posts sp ON sp.scheduler_account_id = sa.id
    GROUP BY sa.id, sa.label, sa.category, sa.is_active
    ORDER BY sa.category, sa.label
  `);

  const accounts = (accountRows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    category: r.category as string,
    is_active: r.is_active as boolean,
    posts_published: Number(r.posts_published ?? 0),
  }));

  // The oldest/newest capture dates tell the UI how much history actually
  // exists -- comparative scoring is meaningless on a single day of data, and
  // the dashboard says so rather than pretending otherwise.
  const captureDates = items.map((i) => i.captured_on).filter((d): d is string => !!d).sort();

  return NextResponse.json({
    items,
    accounts,
    coverage: {
      first_captured_on: captureDates[0] ?? null,
      last_captured_on: captureDates[captureDates.length - 1] ?? null,
      distinct_days: new Set(captureDates).size,
    },
  });
}
