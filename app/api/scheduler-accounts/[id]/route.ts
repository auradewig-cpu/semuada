import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, scheduledPosts } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

// scheduled_posts.scheduler_account_id references this table with ON DELETE
// NO ACTION, so deleting an account that ever posted raises a foreign-key
// violation -- which reached the admin as a raw Postgres error in a toast.
// Since every account accumulates rows from its first build, the button was
// effectively broken for all of them. Same shape as the FK problem that once
// broke the video purge (see the tombstone comment on videoContents.purgedAt).
//
// Deactivating is the right action anyway: the posting history is the record
// of what went out, and it is worth more than a tidy account list.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scheduledPosts)
    .where(eq(scheduledPosts.schedulerAccountId, id));

  if (count > 0) {
    return NextResponse.json(
      {
        error:
          `Akun ini punya ${count} riwayat jadwal, jadi tidak bisa dihapus tanpa ikut menghapus riwayatnya. ` +
          `Matikan tombol "Aktif" saja -- akun berhenti dapat jadwal baru dan riwayatnya tetap utuh.`,
      },
      { status: 409 },
    );
  }

  const [row] = await db.delete(schedulerAccounts).where(eq(schedulerAccounts.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Akun scheduler tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
