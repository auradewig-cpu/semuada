import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { characters } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await db.delete(characters).where(eq(characters.id, id));

  return NextResponse.json({ ok: true });
}
