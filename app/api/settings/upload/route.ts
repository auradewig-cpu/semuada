import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@root/lib/apiAuth";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]);

// Generic image upload for site-wide settings assets (logo, favicon, OG
// image). Unlike character photos, these render directly in public-facing
// <img>/<link> tags across the storefront, so the blob is uploaded with
// access: "public" -- no authenticated proxy route needed to read it back.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diupload." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Format file tidak didukung. Gunakan PNG, JPG, WEBP, SVG, atau ICO." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 5MB." }, { status: 400 });
  }

  const folder = typeof kind === "string" && kind.trim() ? kind.trim() : "misc";
  const blob = await put(`settings/${folder}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
