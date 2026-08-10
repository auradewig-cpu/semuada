// Rotating posting-time pattern: each account's base times drift forward by
// a fixed increment every day the build-schedule cron runs, until the LATEST
// base time would reach the account's cap time, then the whole pattern wraps
// back to the base times. Modulo arithmetic handles the wrap (and any
// increment that doesn't evenly divide the window) without a separate
// "if exceeds, reset" branch.
//
// The drift exists so an account doesn't publish at exactly the same minute
// every single day, which reads as automation. Windows are deliberately
// narrow (~10 minutes) because eight accounts now share the same peak hours:
// a wider drift would buy more variation at the cost of accounts colliding
// with each other, which is the more telling pattern of the two.

// Days at each posting frequency before stepping up: 1/day for the first 30
// days, 2/day for the next 30, then 3/day from day 60 on.
export const RAMP_PHASE_DAYS = 30;

// How many of an account's baseTimes are live today. Slots are enabled from
// the FRONT of baseTimes, which is why that array is ordered by priority
// rather than by clock -- a once-a-day account should be posting in its best
// hour, not merely its earliest.
//
// An account with no rampStartedAt uses every slot it has, so hand-edited
// accounts and anything predating the ramp keep working unchanged.
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
  if (!account.rampStartedAt) return account.baseTimes.length;
  const startedAt = account.rampStartedAt instanceof Date ? account.rampStartedAt : new Date(account.rampStartedAt);
  if (isNaN(startedAt.getTime())) return account.baseTimes.length;

  const daysLive = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));
  // Clamped at 1 so a rampStartedAt in the future (a scheduled launch, or
  // clock skew) still posts once a day rather than going silent.
  const phase = Math.max(1, Math.floor(daysLive / RAMP_PHASE_DAYS) + 1);
  return Math.min(phase, account.baseTimes.length);
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

// dayIndex is the account's rotationDayIndex -- 0 on the day the pattern was
// (re)set to its base times, incrementing by 1 each successful daily build.
export function computeSlotTimes(baseTimes: string[], incrementMinutes: number, capTime: string, dayIndex: number): string[] {
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
  const offset = ((dayIndex * incrementMinutes) % window + window) % window;
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
