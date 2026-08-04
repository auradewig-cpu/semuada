import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { cloudinary } from "@root/lib/cloudinary";
import { requireAuth } from "@root/lib/apiAuth";

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
