import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { laneUpdate, validateLaneAssignment } from "@root/lib/scheduler/videoLane";

// Bulk lane assignment: reserve many videos for one scheduler account, or send
// them back to the shared pool with scheduler_account_id: null.
//
// Its own endpoint rather than N calls to PATCH /video-content/[id] because
// this is how a backlog gets organised -- there were 440 unassigned videos when
// lanes shipped, and tidying those one request at a time would be both slow and
// non-atomic.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string" && !!v) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu video." }, { status: 400 });
  }

  const laneId = laneUpdate(body?.scheduler_account_id);
  if (laneId === undefined) {
    return NextResponse.json({ error: "scheduler_account_id wajib diisi (pakai null untuk mengembalikan ke kolam bersama)." }, { status: 400 });
  }

  const rows = await db.select().from(videoContents).where(inArray(videoContents.id, ids));
  if (rows.length === 0) {
    return NextResponse.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }

  if (laneId !== null) {
    // Every selected video must belong to the target account's category.
    // Validated once against the distinct categories in the selection rather
    // than per row, and rejected as a whole: a partial success here would
    // leave the admin guessing which of their 30 videos actually moved.
    const categories = [...new Set(rows.map((r) => r.category))];
    for (const category of categories) {
      const invalid = await validateLaneAssignment(laneId, category);
      if (invalid) {
        const affected = rows.filter((r) => r.category === category).length;
        return NextResponse.json({ error: `${invalid} (${affected} dari ${rows.length} video terpilih).` }, { status: 400 });
      }
    }
  }

  const updated = await db
    .update(videoContents)
    .set({ schedulerAccountId: laneId })
    .where(inArray(videoContents.id, rows.map((r) => r.id)))
    .returning({ id: videoContents.id });

  return NextResponse.json({ ok: true, assigned: updated.length });
}
