import { z } from "zod";
import { MAX_SLOTS_PER_DAY, MIN_DRIFT_WINDOW_MINUTES } from "./rotation";

// "HH:mm", 24-hour. Same format used for baseTimes entries and capTime.
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm, mis. 06:00.");

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

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
  // Capped so the form rejects a 4th time outright rather than accepting it
  // and having activeSlotCount() silently ignore it -- which would only
  // become visible on day 90, when the account failed to step up as expected.
  base_times: z
    .array(timeSchema)
    .min(1, "Minimal 1 jam dasar.")
    .max(MAX_SLOTS_PER_DAY, `Maksimal ${MAX_SLOTS_PER_DAY} jam dasar (batas ${MAX_SLOTS_PER_DAY}x posting per hari).`),
  // Deprecated: the rotation no longer walks the pattern forward by a fixed
  // increment (see lib/scheduler/rotation.ts). Kept optional so existing
  // clients and rows keep validating; the value is ignored.
  increment_minutes: z.number().int().positive("increment_minutes harus lebih dari 0.").optional(),
  cap_time: timeSchema,
  is_active: z.boolean().default(true),
}).superRefine((value, ctx) => {
  // Without this the form happily accepts a capTime at or before the latest
  // base time, and computeSlotTimes() then THROWS at 01:00 -- which, before
  // the cron learned to isolate accounts, took down the nightly build for
  // every account at once. Checked here so the admin sees it while typing
  // rather than as a silent missing build the next morning.
  const latest = Math.max(...value.base_times.map(toMinutes));
  const window = toMinutes(value.cap_time) - latest;
  if (window < MIN_DRIFT_WINDOW_MINUTES) {
    const latestTime = value.base_times.reduce((a, b) => (toMinutes(a) >= toMinutes(b) ? a : b));
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cap_time"],
      message:
        `Jam batas (${value.cap_time}) harus minimal ${MIN_DRIFT_WINDOW_MINUTES} menit setelah jam dasar paling akhir (${latestTime}). ` +
        `Sekarang jaraknya ${window} menit.`,
    });
  }
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
