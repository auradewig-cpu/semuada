import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireCronSecret } from "@root/lib/cronAuth";
import { destroyVideoAsset } from "@root/lib/videoStorage";

const TRASH_RETENTION_DAYS = 30;

// Runs once/day (Vercel Cron). Permanently deletes videos that have sat in
// trash (trashedAt set by dispatchScheduledPost on a successful post, or by
// a manual delete elsewhere) for longer than the retention window.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = await db
    .select()
    .from(videoContents)
    .where(and(isNotNull(videoContents.trashedAt), lt(videoContents.trashedAt, cutoff)));

  for (const video of expired) {
    await destroyVideoAsset(video);
    await db.delete(videoContents).where(eq(videoContents.id, video.id));
  }

  return NextResponse.json({ ok: true, purged: expired.length });
}
