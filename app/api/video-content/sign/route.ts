import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "@root/lib/apiAuth";
import { resolveStorageAccount } from "@root/lib/videoStorage";
import { slugify } from "@/lib/utils";

// Generates a signature so the browser can upload the video file DIRECTLY to
// Cloudinary (bypassing our own server entirely for the large binary) --
// Vercel Functions cap request bodies at 100MB, and relaying video uploads
// through our server would also just be a slow, unnecessary hop. The API
// secret used to sign never leaves this route.
//
// Each category has its own Cloudinary account (free-tier storage spread
// across several accounts) -- api_sign_request() is pure HMAC signing, it
// doesn't need the SDK's global .config() to be set for the target account.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "uncategorized";

  const account = await resolveStorageAccount(category);
  if (!account) {
    return NextResponse.json(
      { error: "Belum ada storage Cloudinary yang dikonfigurasi. Tambahkan lewat 'Kelola Storage' di Video Library." },
      { status: 400 }
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `videos/${slugify(category)}`;
  const paramsToSign = { timestamp, folder };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, account.apiSecret);

  return NextResponse.json({
    timestamp,
    folder,
    signature,
    apiKey: account.apiKey,
    cloudName: account.cloudName,
    storageAccountId: account.id,
  });
}
