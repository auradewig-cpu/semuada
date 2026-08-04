import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import JSZip from "jszip";
import { requireAuth } from "@root/lib/apiAuth";

const MAX_IMAGES = 10;
const MAX_BYTES_PER_IMAGE = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const bare = contentType.split(";")[0].trim().toLowerCase();
  return EXT_BY_CONTENT_TYPE[bare] || null;
}

function extensionFromUrl(pathname: string): string | null {
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(pathname);
  return match ? match[1].toLowerCase() : null;
}

// Fetches each image server-side (not from the browser) since third-party
// product image CDNs don't reliably send CORS headers permissive enough for
// a client-side fetch to read the response bytes.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u: unknown): u is string => typeof u === "string") : [];
  const filename = typeof body?.filename === "string" && body.filename.trim() ? body.filename.trim() : "images.zip";

  if (urls.length === 0) {
    return NextResponse.json({ error: "Tidak ada gambar untuk didownload." }, { status: 400 });
  }
  if (urls.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Maksimal ${MAX_IMAGES} gambar per download.` }, { status: 400 });
  }

  const zip = new JSZip();
  let addedCount = 0;

  await Promise.all(
    urls.map(async (rawUrl: string, index: number) => {
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return;
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(parsed.toString(), { signal: controller.signal });
        if (!res.ok) return;

        const contentLength = Number(res.headers.get("content-length") || 0);
        if (contentLength > MAX_BYTES_PER_IMAGE) return;

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > MAX_BYTES_PER_IMAGE) return;

        const ext =
          extensionFromContentType(res.headers.get("content-type")) ||
          extensionFromUrl(parsed.pathname) ||
          "jpg";
        zip.file(`image-${index + 1}.${ext}`, buffer);
        addedCount++;
      } catch {
        // Skip a single failed/slow image rather than failing the whole batch.
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  if (addedCount === 0) {
    return NextResponse.json({ error: "Semua gambar gagal diunduh." }, { status: 502 });
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
