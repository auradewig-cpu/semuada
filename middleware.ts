import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@root/auth.config";

const { auth } = NextAuth(authConfig);

// Short-lived in-memory cache so maintenance mode doesn't add a DB round
// trip to every single public request -- worst case a toggle takes up to
// this long to take effect for in-flight edge instances.
const MAINTENANCE_CACHE_MS = 30_000;
let maintenanceCache: { value: boolean; expiresAt: number } | null = null;

async function isMaintenanceModeOn(origin: string): Promise<boolean> {
  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.value;
  }
  try {
    const res = await fetch(new URL("/api/settings", origin), { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    const value = Boolean(data.maintenance_mode);
    maintenanceCache = { value, expiresAt: now + MAINTENANCE_CACHE_MS };
    return value;
  } catch {
    // If the settings read fails, fail open (site stays up) rather than
    // accidentally locking everyone out over a transient error.
    return false;
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/dashboard")) {
    // Same class of bug as lib/apiAuth.ts: on next-auth 5.0.0-beta.31, an
    // internal config/host-validation error can resolve req.auth to a truthy
    // ERROR OBJECT (`{ message: "..." }`) instead of null/undefined -- a bare
    // `!req.auth` check treats that as a valid session and serves the
    // dashboard with zero login. Require an actual `user` on it.
    if (!req.auth || !("user" in req.auth) || !req.auth.user) {
      const loginUrl = new URL("/admin/login", req.nextUrl.origin);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Public storefront route -- gate behind maintenance mode if enabled.
  // /admin/* is excluded from this matcher branch entirely (see `config`
  // below) so admins can always reach /admin/login to switch it back off.
  if (await isMaintenanceModeOn(req.nextUrl.origin)) {
    const maintenanceUrl = new URL("/maintenance", req.nextUrl.origin);
    return NextResponse.rewrite(maintenanceUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/dashboard",
    "/((?!api|_next/static|_next/image|favicon\\.ico|maintenance|admin).*)",
  ],
};
