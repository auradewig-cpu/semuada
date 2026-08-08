import { z } from "zod";

// "HH:mm", 24-hour. Same format used for baseTimes entries and capTime.
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm, mis. 06:00.");

// id present = edit existing row, absent = insert new row -- unlike
// videoStorageAccounts (upsert by unique category), label/category aren't
// unique here since multiple accounts can share a category.
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
  base_times: z.array(timeSchema).min(1, "Minimal 1 jam dasar."),
  increment_minutes: z.number().int().positive("increment_minutes harus lebih dari 0."),
  cap_time: timeSchema,
  is_active: z.boolean().default(true),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
