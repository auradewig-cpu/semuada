import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { authConfig } from "@root/auth.config";
import { getMaintenanceFlag } from "@root/lib/site-settings";

const { auth } = NextAuth(authConfig);

// In-memory maintenance gate, refreshed in the BACKGROUND and never awaited on
// the request path.
//
// This used to `await fetch("/api/settings")` -- an HTTP hop from middleware
// back into our own deployment, which then hit the DB -- before letting any
// public request through. Measured on a fully static page: 280ms on a cold
// instance vs 4ms once warm. Since the cache is per-instance, Vercel paid that
// again on every cold start and scale-out, in front of every single page view.
//
// Now: reads the DB directly (no HTTP hop), and a stale cache serves the LAST
// KNOWN value while a refresh runs in the background via event.waitUntil().
// Trade-off, chosen deliberately: a brand-new instance starts from `false`, so
// while maintenance mode is ON it can serve roughly one request with the normal
// site before the first refresh lands. That matches the fail-open stance this
// gate already took for read errors -- the site staying up is the safe failure
// here, not locking everyone out.
const MAINTENANCE_CACHE_MS = 60_000;
const MAINTENANCE_ERROR_BACKOFF_MS = 5_000;

let maintenanceValue = false;
let maintenanceExpiresAt = 0;
let maintenanceRefresh: Promise<void> | null = null;

function refreshMaintenanceFlag(): Promise<void> {
  // Collapse concurrent misses onto one DB read -- an instance handling a
  // burst of requests must not fire one query per request.
  if (maintenanceRefresh) return maintenanceRefresh;
  maintenanceRefresh = getMaintenanceFlag()
    .then((value) => {
      maintenanceValue = value;
      maintenanceExpiresAt = Date.now() + MAINTENANCE_CACHE_MS;
    })
    .catch(() => {
      // Keep the last known value and back off, so a DB blip doesn't turn
      // into a retry storm on every request.
      maintenanceExpiresAt = Date.now() + MAINTENANCE_ERROR_BACKOFF_MS;
    })
    .finally(() => {
      maintenanceRefresh = null;
    });
  return maintenanceRefresh;
}

function isMaintenanceModeOn(event?: NextFetchEvent): boolean {
  if (Date.now() >= maintenanceExpiresAt) {
    const refresh = refreshMaintenanceFlag();
    // waitUntil keeps the refresh alive past the response on Vercel; without
    // it the runtime may tear the instance down mid-query and the cache would
    // never warm up.
    event?.waitUntil?.(refresh);
  }
  return maintenanceValue;
}

export default auth(async (req, event?: NextFetchEvent) => {
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
  if (isMaintenanceModeOn(event)) {
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
