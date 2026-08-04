import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cloudinary } from "@root/lib/cloudinary";
import { requireAuth } from "@root/lib/apiAuth";
import { slugify } from "@/lib/utils";

// Generates a signature so the browser can upload the video file DIRECTLY to
// Cloudinary (bypassing our own server entirely for the large binary) --
// Vercel Functions cap request bodies at 100MB, and relaying video uploads
// through our server would also just be a slow, unnecessary hop. The API
// secret used to sign never leaves this route.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "uncategorized";

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `videos/${slugify(category)}`;
  const paramsToSign = { timestamp, folder };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);

  return NextResponse.json({
    timestamp,
    folder,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
