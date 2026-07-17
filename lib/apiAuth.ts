import { NextResponse } from "next/server";
import { auth } from "@root/auth";

// Fail CLOSED. Two distinct failure modes had to be guarded here:
// 1. auth() throwing (host validation error, misconfigured AUTH_SECRET/
//    AUTH_URL, etc.) -- caught below instead of propagating.
// 2. auth() NOT throwing but resolving to a truthy error object instead of
//    null (confirmed on next-auth 5.0.0-beta.31: an internal config error
//    resolves to `{ message: "There was a problem with the server
//    configuration..." }`). A plain `if (!session)` check treats that
//    error object as a valid session and lets the request through --
//    this was a real, reproducible unauthenticated-access bug on every
//    route using requireAuth(). Requiring `session.user` to be present
//    closes it: real sessions always have a user, error objects don't.
export async function requireAuth() {
  try {
    const session = await auth();
    if (!session || !("user" in session) || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
