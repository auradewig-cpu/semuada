import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { scheduledPosts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { dispatchScheduledPost, platformsNeedingDispatch } from "@root/lib/scheduler/dispatch";
import type { ProviderResults } from "@root/lib/scheduler/types";

// Per-card "Jadwalkan & Post Sekarang" retry button -- for posts with at
// least one platform that hasn't succeeded yet. This covers BOTH a fully
// "failed" post AND a "posted" post with partial per-platform failure (e.g.
// Buffer platforms succeeded but a Zernio platform didn't) -- the latter was
// originally missed: status flips to "posted" the moment any ONE platform
// succeeds, so gating strictly on status === "failed" left partial failures
// with no retry path at all. Always publishes immediately (no scheduledAt
// passed to dispatchScheduledPost), same semantics as the account-level
// manual trigger -- the post's original scheduledFor time has already
// passed, so there's nothing left to schedule for later.
//
// Only re-dispatches platformsNeedingDispatch(post) -- i.e. platforms
// without a recorded ok:true result -- so a platform that already succeeded
// is never re-sent and can't get duplicate-posted. Rejects outright if there
// is nothing left to retry (every platform already succeeded).
// Not a preview/dry-run -- has real, immediately-visible effects on the
// connected social accounts.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [post] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, id));
  if (!post) {
    return NextResponse.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
  }
  if (post.status === "queued") {
    return NextResponse.json({ error: "Jadwal ini belum pernah diposting -- belum ada yang gagal untuk dicoba ulang." }, { status: 400 });
  }
  // "dispatching" means a cron run has claimed this row and may be mid-call to
  // Buffer/Zernio right now. Retrying on top of that is how a post gets
  // published twice.
  if (post.status === "dispatching") {
    return NextResponse.json({ error: "Jadwal ini sedang diproses. Tunggu sampai selesai sebelum mencoba ulang." }, { status: 409 });
  }
  const retryPlatforms = platformsNeedingDispatch(post);
  if (retryPlatforms.length === 0) {
    return NextResponse.json({ error: "Semua platform di jadwal ini sudah berhasil diposting." }, { status: 400 });
  }

  await dispatchScheduledPost(post, { platforms: retryPlatforms });

  const [updated] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, id));
  const updatedResults = (updated?.providerResults as ProviderResults | null) ?? {};
  // Whether THIS retry attempt succeeded -- not the same as updated.status,
  // which is "posted" as soon as ANY platform on the row has ever succeeded
  // (including ones from a previous attempt, before this retry even ran).
  // Checking only retryPlatforms is what lets the UI report "still failed"
  // correctly on a partial-success post whose retry attempt itself failed.
  const retrySucceeded = retryPlatforms.every((p) => updatedResults[p]?.ok === true);
  const retryErrors = retryPlatforms
    .map((p) => updatedResults[p]?.error)
    .filter((e): e is string => Boolean(e));

  return NextResponse.json({
    ok: true,
    status: updated?.status,
    errorMessage: updated?.errorMessage ?? null,
    retrySucceeded,
    retryErrorMessage: retryErrors.length > 0 ? retryErrors.join("; ") : null,
  });
}
