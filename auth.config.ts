import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no bcrypt/DB access) — used by middleware.
// The full config in auth.ts extends this with the Credentials provider.
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
} satisfies NextAuthConfig;
