import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@root/lib/db";
import { characters } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [deleted] = await db.delete(characters).where(eq(characters.id, id)).returning();

  // Best-effort blob cleanup -- don't fail the delete (already committed in
  // the DB) just because the blob was already gone or the API hiccuped.
  if (deleted?.photoUrl) {
    try {
      await del(deleted.photoUrl);
    } catch {
      // orphaned blob, not worth failing the request over
    }
  }

  return NextResponse.json({ ok: true });
}
