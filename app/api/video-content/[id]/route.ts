import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { toApiVideoContent } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";
import { removeVideo } from "@root/lib/videoStorage";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const set: { caption?: string; hashtags?: string[] } = {};
  if (typeof body?.caption === "string") set.caption = body.caption;
  if (Array.isArray(body?.hashtags)) set.hashtags = body.hashtags.filter((h: unknown): h is string => typeof h === "string");

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan untuk disimpan." }, { status: 400 });
  }

  const [row] = await db.update(videoContents).set(set).where(eq(videoContents.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(toApiVideoContent(row));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const [row] = await db.select().from(videoContents).where(eq(videoContents.id, id));
  if (!row) {
    return NextResponse.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }

  // Destroys the Cloudinary asset, then deletes the row only when nothing
  // references it. This used to be a bare db.delete(), which meant deleting
  // any video that had ever been posted failed outright with a foreign-key
  // violation from scheduled_posts -- see removeVideo() for the full story.
  await removeVideo(row);

  return NextResponse.json({ ok: true });
}
