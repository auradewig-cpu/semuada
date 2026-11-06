import { z } from "zod";
import { MAX_POSTS_PER_DAY } from "./rotation";

// id present = edit existing row, absent = insert new row -- unlike
// videoStorageAccounts (upsert by unique category), label/category aren't
// unique here since multiple accounts can share a category.
//
// Posting TIMES are no longer part of an account: they are allocated
// automatically for the whole fleet (lib/scheduler/rotation.ts). Old clients
// that still send base_times / cap_time / increment_minutes validate fine --
// zod strips unknown keys -- and those values are simply ignored.
export const schedulerAccountRequestSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "label wajib diisi."),
  category: z.string().min(1, "category wajib diisi."),
  buffer_api_key: z.string().nullable().optional(),
  zernio_api_key: z.string().nullable().optional(),
  tiktok_account_id: z.string().nullable().optional(),
  instagram_account_id: z.string().nullable().optional(),
  youtube_account_id: z.string().nullable().optional(),
  threads_account_id: z.string().nullable().optional(),
  facebook_page_account_id: z.string().nullable().optional(),
  // Also a CHECK constraint in the database; validated here so the admin gets
  // a readable message instead of a constraint error.
  //
  // Optional with NO zod default, on purpose: absent must mean "keep what the
  // account has" on an edit. A default here would quietly reset any account
  // edited by a caller that omits the field -- the same absent-means-overwrite
  // trap that once wiped both API keys (see the scheduler-accounts route). On
  // insert, absent falls through to the column default, DEFAULT_POSTS_PER_DAY.
  posts_per_day: z
    .number()
    .int("Posting per hari harus bilangan bulat.")
    .min(1, "Minimal 1 posting per hari.")
    .max(MAX_POSTS_PER_DAY, `Maksimal ${MAX_POSTS_PER_DAY} posting per hari.`)
    .optional(),
  is_active: z.boolean().default(true),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
