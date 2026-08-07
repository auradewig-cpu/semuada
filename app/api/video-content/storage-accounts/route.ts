import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@root/lib/db";
import { videoStorageAccounts } from "@shared/schema";
import { toApiVideoStorageAccount } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(videoStorageAccounts).orderBy(asc(videoStorageAccounts.category));
  return NextResponse.json({ items: rows.map(toApiVideoStorageAccount) });
}

// Upserts by category -- "Tambah Storage" for a category that already has an
// account overwrites it (blank cloud_name/api_key/api_secret fields are
// rejected outright here, unlike aiSettings' "blank = leave unchanged",
// since this form always collects all 3 fields together, not partial edits).
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (typeof body?.category !== "string" || !body.category.trim()) {
    return NextResponse.json({ error: "category wajib diisi." }, { status: 400 });
  }
  if (typeof body?.cloud_name !== "string" || !body.cloud_name.trim()) {
    return NextResponse.json({ error: "cloud_name wajib diisi." }, { status: 400 });
  }
  if (typeof body?.api_key !== "string" || !body.api_key.trim()) {
    return NextResponse.json({ error: "api_key wajib diisi." }, { status: 400 });
  }
  if (typeof body?.api_secret !== "string" || !body.api_secret.trim()) {
    return NextResponse.json({ error: "api_secret wajib diisi." }, { status: 400 });
  }

  const values = {
    category: body.category.trim(),
    cloudName: body.cloud_name.trim(),
    apiKey: body.api_key.trim(),
    apiSecret: body.api_secret.trim(),
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(videoStorageAccounts)
    .values(values)
    .onConflictDoUpdate({ target: videoStorageAccounts.category, set: values })
    .returning();

  return NextResponse.json(toApiVideoStorageAccount(row), { status: 201 });
}
