import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts } from "@shared/schema";

// Validates that a video may be reserved for a given scheduler account.
//
// The category check is the load-bearing one. A lane is only ever drained by
// buildScheduleForAccount() for the account that owns it, and that account only
// ever builds for its OWN category -- so reserving a "Perlengkapan Rumah" video
// for Melisani (Pakaian Wanita) would lock it in a lane nothing ever reads.
// The video would sit at status 'uploaded' forever, invisible to every account
// including the shared pool, with no error anywhere. Refuse it at the boundary
// instead.
//
// Returns null when the assignment is fine, or a reason string to reject with.
export async function validateLaneAssignment(
  schedulerAccountId: string,
  videoCategory: string
): Promise<string | null> {
  const [account] = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.id, schedulerAccountId));

  if (!account) return "Akun scheduler tidak ditemukan.";
  if (!account.isActive) return `Akun "${account.label}" sedang nonaktif, tidak bisa menerima video baru.`;
  if (account.category !== videoCategory) {
    return `Akun "${account.label}" ada di kategori "${account.category}", sedangkan video ini kategori "${videoCategory}". Video hanya bisa ditugaskan ke akun pada kategori yang sama.`;
  }
  return null;
}

// Normalises the wire value for scheduler_account_id.
// Absent -> undefined (leave as-is), explicit null/"" -> null (back to the
// shared pool), a string -> that id. Mirrors keyUpdate() in the
// scheduler-accounts route, and for the same reason: Drizzle's .set() drops
// `undefined` but WRITES `null`, so conflating the two destroys data.
export function laneUpdate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return typeof value === "string" ? value : undefined;
}
