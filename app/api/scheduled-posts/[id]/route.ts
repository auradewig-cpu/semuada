import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { scheduledPosts, schedulerAccounts, videoContents } from "@shared/schema";
import { toApiScheduledPost } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

// Swaps which video fills an already-queued slot -- the manual override on
// top of the default FIFO auto-fill from buildScheduleForAccount(). Only
// valid while the post is still "queued" (can't swap a video that already
// posted). No multi-statement transaction (this project's neon-http driver
// doesn't support one, same constraint claimNextVideos() already works
// around) -- release-then-claim as two statements, with the release undone
// if the claim fails. Acceptable race window given this is a low-traffic
// admin tool with a handful of accounts, not a public endpoint.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.video_content_id !== "string" || !body.video_content_id) {
    return NextResponse.json({ error: "video_content_id wajib diisi." }, { status: 400 });
  }
  const newVideoId: string = body.video_content_id;

  const [post] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, id));
  if (!post) {
    return NextResponse.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
  }
  if (post.status !== "queued") {
    return NextResponse.json({ error: `Jadwal ini sudah berstatus "${post.status}", tidak bisa diganti videonya.` }, { status: 400 });
  }

  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, post.schedulerAccountId));
  if (!account) {
    return NextResponse.json({ error: "Akun scheduler untuk jadwal ini tidak ditemukan." }, { status: 404 });
  }

  const oldVideoId = post.videoContentId;
  if (newVideoId === oldVideoId) {
    return NextResponse.json({ error: "Video yang dipilih sama dengan yang sudah terpasang." }, { status: 400 });
  }

  // Release the old video back to the pool first.
  await db.update(videoContents).set({ status: "uploaded" }).where(and(eq(videoContents.id, oldVideoId), eq(videoContents.status, "scheduled")));

  // Try to claim the new one. Only succeeds if it was actually still
  // "uploaded" (the WHERE is the race-safety, not the post-hoc check below).
  // Category must match the account's pool -- prevents swapping in a video
  // from an unrelated category by mistake.
  const [claimed] = await db
    .update(videoContents)
    .set({ status: "scheduled" })
    .where(and(eq(videoContents.id, newVideoId), eq(videoContents.status, "uploaded"), eq(videoContents.category, account.category)))
    .returning();

  if (!claimed) {
    // Undo the release -- the swap didn't go through.
    await db.update(videoContents).set({ status: "scheduled" }).where(eq(videoContents.id, oldVideoId));
    return NextResponse.json({ error: "Video yang dipilih sudah tidak tersedia atau bukan dari kategori yang sesuai." }, { status: 409 });
  }

  const [updatedPost] = await db
    .update(scheduledPosts)
    .set({ videoContentId: newVideoId })
    .where(eq(scheduledPosts.id, id))
    .returning();

  return NextResponse.json({
    ...toApiScheduledPost(updatedPost),
    video_url: claimed.videoUrl,
    caption: claimed.caption,
    hashtags: claimed.hashtags,
  });
}
