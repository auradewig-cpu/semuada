import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@root/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
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
});

export const config = {
  matcher: ["/admin/dashboard"],
};
