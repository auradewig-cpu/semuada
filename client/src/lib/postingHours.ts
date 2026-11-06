import type { SocialMetricRow } from "@/hooks/useSchedulerMetrics";

// Which hour of the day performs best -- computed so that a strong account
// cannot pass for a strong hour.
//
// Raw views per hour are useless here, measured: TikTok at 12/16/20 read as
// dead hours (median 0) when every one of those posts was Caca Anindya, whose
// TikTok sits at a median of 0 whatever the hour, and YouTube's "best hour"
// was simply Caca's YouTube. So each post is scored against its OWN account's
// typical result on the same platform, in log space:
//
//     s = log(views + 1) - mean of log(views + 1) over that account+platform
//
// i.e. the post's views relative to that account's geometric mean. Each hour
// then reports exp(mean s) as "1.4x": 1.0x = an ordinary hour for these
// accounts, 1.5x = half again as many views as usual. The +1 keeps zero-view
// posts in the log domain.
//
// Three choices, each made after the simpler one measured wrong on the real
// data:
//   - Centred on the account's log-mean, not divided by its median. With a
//     median baseline a skewed account inflated its own hours: Caca's TikTok
//     median is 0, so every Caca post with any views at all scored high and
//     her hours 12/16/20 came out 1.9-3.1x purely from her shape. Centring
//     makes every account average exactly 1.0x over its own posts, so its
//     level cancels and only the differences between its hours remain.
//   - Each s is clamped to +/- log(10) so one viral post can move an hour by
//     at most 10x -- and then RE-CENTRED per account. Clamping alone biased
//     upward: accounts with many 0-view posts have a long low tail, lifting it
//     to the floor pushed almost every YouTube hour above 1.0x.
//   - Aggregated by mean, not median. The median was tried first and every
//     hour came out at exactly 1.00x, because a large share of rows are ties
//     (0 views on a 0 baseline, Threads especially).
//
// An (account, platform) whose views never vary -- all zeros, say -- is left
// out entirely: it says nothing about any hour, only drags every hour toward
// 1.0x and inflates the post counts.

// Below this many scored posts an hour's number is shown but flagged.
export const MIN_POSTS_FOR_READING = 10;

// The hours the automatic allocation posts in (07:00-21:55, see
// lib/scheduler/rotation.ts). Always listed, even before they have data, so
// the gaps are visible; hours outside this range appear only if old posts
// sit there.
const ALLOCATED_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i);

const MAX_LOG_SCORE = Math.log(10);

export interface HourCell {
  n: number;
  score: number | null;
}

export interface HourRow {
  hour: number;
  all: HourCell;
  byPlatform: Record<string, HourCell>;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });

// Hour of day (0-23) in WIB.
export function jakartaHour(iso: string): number {
  return Number(hourFormatter.format(new Date(iso))) % 24;
}

function cell(logScores: number[] | undefined): HourCell {
  if (!logScores || logScores.length === 0) return { n: 0, score: null };
  return { n: logScores.length, score: Math.exp(mean(logScores)) };
}

export function postingHourTable(rows: SocialMetricRow[]): HourRow[] {
  const measured = rows.filter((r) => r.views !== null && r.published_at);

  const byPair = new Map<string, SocialMetricRow[]>();
  for (const r of measured) {
    const key = `${r.account_id}|${r.platform}`;
    byPair.set(key, [...(byPair.get(key) ?? []), r]);
  }

  const all = new Map<number, number[]>();
  const byPlatform = new Map<string, number[]>();
  for (const pairRows of byPair.values()) {
    const logs = pairRows.map((r) => Math.log((r.views as number) + 1));
    if (logs.every((l) => l === logs[0])) continue; // no variation, no information
    const centre = mean(logs);
    const clamped = logs.map((l) => Math.min(MAX_LOG_SCORE, Math.max(-MAX_LOG_SCORE, l - centre)));
    const recentre = mean(clamped);
    pairRows.forEach((r, i) => {
      const s = clamped[i] - recentre;
      const hour = jakartaHour(r.published_at as string);
      all.set(hour, [...(all.get(hour) ?? []), s]);
      const pk = `${hour}|${r.platform}`;
      byPlatform.set(pk, [...(byPlatform.get(pk) ?? []), s]);
    });
  }

  const hours = Array.from(new Set([...ALLOCATED_HOURS, ...all.keys()])).sort((a, b) => a - b);
  const platforms = Array.from(new Set(measured.map((r) => r.platform)));
  return hours.map((hour) => ({
    hour,
    all: cell(all.get(hour)),
    byPlatform: Object.fromEntries(platforms.map((p) => [p, cell(byPlatform.get(`${hour}|${p}`))])),
  }));
}

// Up to `limit` hours with enough data, best first.
export function bestHours(table: HourRow[], limit = 3): HourRow[] {
  return table
    .filter((r) => r.all.n >= MIN_POSTS_FOR_READING && r.all.score !== null)
    .sort((a, b) => (b.all.score as number) - (a.all.score as number))
    .slice(0, limit);
}
