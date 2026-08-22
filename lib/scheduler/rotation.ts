// Rotating posting-time pattern: each account's base times are nudged forward
// by an offset picked deterministically from (account, calendar day), landing
// somewhere in the window between the LATEST base time and the account's cap
// time.
//
// The drift exists so an account doesn't publish at exactly the same minute
// every single day, which reads as automation. Windows are deliberately
// narrow (~10 minutes) because nine accounts now share the same peak hours:
// a wider drift would buy more variation at the cost of accounts colliding
// with each other, which is the more telling pattern of the two.
//
// This used to walk the pattern forward by a fixed increment per day
// (offset = dayIndex * incrementMinutes % window), which measured badly
// against its own goal. With a 10-minute window the per-account increments --
// all primes: 7, 11, 13, 17, 19, 23, 29, 31, 37 -- collapsed mod 10 to just
// {1, 3, 7, 9}, so:
//   - four accounts marched in a perfectly straight line, one minute per day
//     (20:02, 20:03, 20:04, ...), which is a MORE mechanical signature than
//     simply posting at a fixed minute;
//   - accounts sharing an effective step stayed a constant distance apart
//     forever (Akun 1 and Naya Ardelia: exactly 20 minutes, every day);
//   - and because offset is 0 whenever dayIndex is a multiple of the window,
//     all nine accounts reset to their exact base times on the SAME day, every
//     10 days -- 36 times a year the whole fleet landed on a tidy :00/:20/:40
//     grid.
// A hash of (accountId, date) removes all three at once, costs nothing, and
// stays fully reproducible for tests. Seeded determinism is an existing
// pattern here -- see seededRandom() in lib/content-generator/rotation.ts.
//
// Keying on the DATE rather than a running counter also means a missed build
// no longer shifts anything: each calendar day owns its offset whether or not
// the cron ran the day before.

// FNV-1a, 32-bit. Deliberately hand-rolled rather than imported from
// node:crypto -- this module is imported by the admin UI (see activeSlotCount
// below), so pulling in a server-only module would break the browser bundle.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// Days at each posting frequency before stepping up: 1/day for the first 30
// days, 2/day for the next 30, then 3/day from day 60 on.
export const RAMP_PHASE_DAYS = 30;

// Hard ceiling on posts per day, whatever an account's baseTimes say. The
// ramp's own cap used to be the number of baseTimes, which made "max 3"
// merely a consequence of every account happening to have three -- add a
// fourth time through the admin form and the account would quietly reach
// 4/day, but only on day 90, long after anyone would connect the two.
// Enforced here as well as in the form's validation: this guarantees the
// behaviour, the validation explains it to whoever is typing.
export const MAX_SLOTS_PER_DAY = 3;

// The drift window is capTime minus the LATEST base time (see
// computeSlotTimes). It has to be wide enough for the day's offset to have
// somewhere to go -- a 1-minute window would put every day on the same minute,
// which is exactly what the rotation exists to avoid. Enforced in
// lib/scheduler/validation.ts and mirrored in the admin form; lives here
// alongside MAX_SLOTS_PER_DAY so the browser bundle can read it without
// pulling in zod.
export const MIN_DRIFT_WINDOW_MINUTES = 5;

// How many of an account's baseTimes are live today. Slots are enabled from
// the FRONT of baseTimes, which is why that array is ordered by priority
// rather than by clock -- a once-a-day account should be posting in its best
// hour, not merely its earliest.
//
// An account with no rampStartedAt skips the warm-up and uses every slot it
// has, so hand-edited accounts and anything predating the ramp keep working
// unchanged -- but still never above MAX_SLOTS_PER_DAY, since that ceiling
// is about the posting cadence itself, not about the ramp.
//
// Lives here, alongside the other pure scheduling math, rather than in
// buildSchedule.ts -- that module imports the database client, so the admin
// UI could not import from it without pulling server-only code into the
// browser bundle. The UI needs this to show how many slots an account is
// actually expected to fill today.
//
// rampStartedAt accepts a string as well as a Date because it arrives as
// JSON from the API on the client and as a Date from Drizzle on the server.
export function activeSlotCount(
  account: { baseTimes: string[]; rampStartedAt: Date | string | null },
  now: Date
): number {
  const uncapped = account.baseTimes.length;
  if (!account.rampStartedAt) return Math.min(uncapped, MAX_SLOTS_PER_DAY);
  const startedAt = account.rampStartedAt instanceof Date ? account.rampStartedAt : new Date(account.rampStartedAt);
  if (isNaN(startedAt.getTime())) return Math.min(uncapped, MAX_SLOTS_PER_DAY);

  const daysLive = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));
  // Clamped at 1 so a rampStartedAt in the future (a scheduled launch, or
  // clock skew) still posts once a day rather than going silent.
  const phase = Math.max(1, Math.floor(daysLive / RAMP_PHASE_DAYS) + 1);
  return Math.min(phase, account.baseTimes.length, MAX_SLOTS_PER_DAY);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// `seed` identifies the account and the calendar day, e.g.
// `${account.id}:2026-08-24`. Same seed always yields the same slot times, so
// this stays trivially testable and a re-run of the build for the same day
// can never shift an already-queued post.
//
// Pass ALL of an account's baseTimes, not just the ones its ramp phase has
// enabled -- slice the RESULT instead. The window is derived from the latest
// entry, so slicing the input would make the window depend on the ramp phase.
// See buildScheduleForAccount() for the full reasoning.
export function computeSlotTimes(baseTimes: string[], capTime: string, seed: string): string[] {
  if (baseTimes.length === 0) return [];
  // The LATEST time, not the last array entry. baseTimes is ordered by
  // priority (see the schema comment) so the frequency ramp can enable slots
  // from the front, which means the final element is usually an earlier time
  // of day. Using it here would compute a window spanning most of the day and
  // send the whole pattern drifting hours out of place.
  const latestBaseMinutes = Math.max(...baseTimes.map(toMinutes));
  const capMinutes = toMinutes(capTime);
  const window = capMinutes - latestBaseMinutes;
  if (window <= 0) {
    throw new Error(`capTime (${capTime}) harus setelah base time paling akhir dalam sehari.`);
  }
  // Every base time shares the day's offset, so the shape of the pattern is
  // preserved and only its position moves. That is also what makes slicing
  // the result equivalent to slicing the input.
  const offset = hashSeed(seed) % window;
  return baseTimes.map((t) => toHHMM(toMinutes(t) + offset));
}

// Combines a "HH:mm" slot time with a calendar date to get the actual
// scheduledFor instant, in the given IANA timezone. Kept separate from
// computeSlotTimes() so the pure rotation math stays trivially testable
// without pulling in timezone conversion.
export function slotTimeToDate(dateISO: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  // Resolve what UTC instant corresponds to `hhmm` on `dateISO` in `timeZone`
  // by asking Intl what that UTC guess renders as locally, then correcting
  // for the difference -- avoids depending on a timezone-database package.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(utcGuess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const renderedAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"));
  const driftMs = renderedAsUTC - utcGuess;
  return new Date(utcGuess - driftMs);
}
