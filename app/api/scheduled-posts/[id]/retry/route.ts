import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { scheduledPosts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { dispatchScheduledPost } from "@root/lib/scheduler/dispatch";

// Per-card "Jadwalkan & Post Sekarang" retry button -- only for posts that
// already failed (e.g. the first real dispatch attempt hitting the Buffer
// schema bug / Zernio presign issue, see the social_scheduler memory).
// Always publishes immediately (no scheduledAt passed to
// dispatchScheduledPost), same semantics as the account-level manual
// trigger -- a failed post's original scheduledFor time has already passed,
// so there's nothing left to schedule for later. Restricted to status
// "failed" specifically so this can't accidentally re-publish something
// that already went out (status "posted") and create a duplicate real post.
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
  if (post.status !== "failed") {
    return NextResponse.json({ error: `Jadwal ini berstatus "${post.status}", bukan "failed" -- tidak bisa dicoba ulang.` }, { status: 400 });
  }

  await dispatchScheduledPost(post);

  const [updated] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, id));
  return NextResponse.json({ ok: true, status: updated?.status, errorMessage: updated?.errorMessage ?? null });
}
