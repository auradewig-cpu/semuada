import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@root/lib/db";
import { characters } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(characters).orderBy(desc(characters.createdAt));
  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const name = formData.get("name");
  const file = formData.get("photo");
  const description = formData.get("description");

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nama karakter wajib diisi." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Foto karakter wajib diupload." }, { status: 400 });
  }

  const blob = await put(`content-generator/characters/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const [row] = await db
    .insert(characters)
    .values({
      name: name.trim(),
      photoUrl: blob.url,
      description: typeof description === "string" && description.trim() ? description.trim() : undefined,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
