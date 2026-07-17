import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { requireAuth } from "@root/lib/apiAuth";
import { db } from "@root/lib/db";
import { characters } from "@shared/schema";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Scope this proxy to actual character photos -- without this check, any
  // authenticated user could fetch ANY blob in the private store by URL,
  // not just character photos, since get() itself doesn't scope by table.
  const [owner] = await db.select({ id: characters.id }).from(characters).where(eq(characters.photoUrl, url));
  if (!owner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      // Each upload gets a fresh timestamped blob URL (see characters/route.ts),
      // so the content behind a given `url` never changes -- safe to let the
      // BROWSER cache it long-term (still "private" so no shared/CDN cache
      // stores it). Previously "no-cache" forced a full re-fetch (auth check +
      // DB scoping query + Blob read) on every single render, which is why
      // the character grid felt slow to load every time it was revisited.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
