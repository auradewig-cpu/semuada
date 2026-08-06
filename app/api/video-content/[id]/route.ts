import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { cloudinary } from "@root/lib/cloudinary";
import { toApiVideoContent } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

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

  const [row] = await db.delete(videoContents).where(eq(videoContents.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }

  // Best-effort Cloudinary cleanup, same pattern as character-photo delete --
  // don't fail the request over an already-gone or slow remote asset.
  try {
    await cloudinary.uploader.destroy(row.cloudinaryPublicId, { resource_type: "video" });
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
