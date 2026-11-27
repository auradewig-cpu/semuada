import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { removeVideo } from "@root/lib/videoStorage";
import { deleteMetricsForExpiredPosts } from "@root/lib/scheduler/metrics";
import { METRICS_RETENTION_DAYS, TRASH_RETENTION_DAYS } from "@root/lib/retention";

const DAY_MS = 24 * 60 * 60 * 1000;

// Runs once/day (Vercel Cron). Frees the Cloudinary asset for videos that
// have sat in trash (trashedAt set by dispatchScheduledPost on a successful
// post, or by a manual delete elsewhere) for longer than the retention
// window. See removeVideo() for why an already-posted video leaves a
// tombstone row behind instead of being deleted outright.
//
// `purgedAt IS NULL` keeps already-handled tombstones out of the query --
// without it every past purge would be retried forever, re-destroying assets
// that are already gone.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * DAY_MS);
  const expired = await db
    .select()
    .from(videoContents)
    .where(and(isNotNull(videoContents.trashedAt), lt(videoContents.trashedAt, cutoff), isNull(videoContents.purgedAt)));

  // Each video is isolated: a single failure (a Cloudinary hiccup, an
  // unexpected constraint) must not abort the rest of the run, which is how
  // the previous version would have wedged itself on the same first row
  // every single day.
  let purged = 0;
  let deleted = 0;
  const failed: Array<{ id: string; error: string }> = [];
  for (const video of expired) {
    try {
      const outcome = await removeVideo(video);
      if (outcome === "purged") purged++;
      else deleted++;
    } catch (err) {
      failed.push({ id: video.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Metrics run on their OWN cutoff (lib/retention.ts). They used to reuse the
  // trash cutoff above, which was harmless while both were 30 days -- but with
  // trash at 3 days it would have deleted every snapshot older than 3 days and
  // emptied the Dashboard and the posting-hour analysis.
  const metricsCutoff = new Date(Date.now() - METRICS_RETENTION_DAYS * DAY_MS);
  const metricsDeleted = await deleteMetricsForExpiredPosts(metricsCutoff);

  return NextResponse.json({ ok: true, purged, deleted, failed, metricsDeleted });
}
