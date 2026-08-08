import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cron/GitHub-Actions-triggered routes have no admin session (see apiAuth.ts's
// requireAuth() for the session-based counterpart used by the rest of the
// admin API) -- these are authenticated by a shared secret instead, sent as
// a standard bearer header by both Vercel Cron and the GitHub Actions
// workflow that calls the high-frequency dispatch endpoint.
export function requireCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum diset di environment." }, { status: 500 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
