// Rotating posting-time pattern: each account's base times drift forward by
// a fixed increment every day the build-schedule cron runs, until the LAST
// base time would reach the account's cap time, then the whole pattern wraps
// back to the base times. Modulo arithmetic handles the wrap (and any
// increment that doesn't evenly divide the window) without a separate
// "if exceeds, reset" branch.

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
  const lastBaseMinutes = toMinutes(baseTimes[baseTimes.length - 1]);
  const capMinutes = toMinutes(capTime);
  const window = capMinutes - lastBaseMinutes;
  if (window <= 0) {
    throw new Error(`capTime (${capTime}) harus setelah base time terakhir (${baseTimes[baseTimes.length - 1]}).`);
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
