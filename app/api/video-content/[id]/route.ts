import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@root/lib/db";
import { videoContents, videoStorageAccounts } from "@shared/schema";
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
  // Credentials are passed as per-call options (not a global .config()
  // mutation) since Vercel's Fluid Compute can reuse a warm instance across
  // concurrent requests -- mutating shared SDK state per-request would let
  // two concurrent deletes for different accounts race and destroy against
  // the wrong credentials.
  try {
    if (row.storageAccountId) {
      const [account] = await db.select().from(videoStorageAccounts).where(eq(videoStorageAccounts.id, row.storageAccountId));
      if (account) {
        // The SDK's Node types don't declare cloud_name/api_key/api_secret as
        // valid per-call overrides, but the JS runtime honors them (this is
        // Cloudinary's documented way to hit a different account per call) --
        // cast to bypass the incomplete type, not to bypass real safety.
        await cloudinary.uploader.destroy(row.cloudinaryPublicId, {
          resource_type: "video",
          cloud_name: account.cloudName,
          api_key: account.apiKey,
          api_secret: account.apiSecret,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
