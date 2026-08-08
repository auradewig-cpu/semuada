import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const [row] = await db.delete(schedulerAccounts).where(eq(schedulerAccounts.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
