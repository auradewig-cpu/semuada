// Daily posting times, allocated automatically for every account at once.
//
// THE GOAL is measurement as much as camouflage: find out which hour of the
// day actually performs, from this fleet's own numbers. The previous design
// could never answer that. Each account owned a hand-typed set of base times
// and only drifted ~10 minutes around them, so "hour 20" in the metrics was
// really "the three accounts that happen to post at 20:xx" -- TikTok at
// 12/16/20 read as dead hours when every one of those posts was Caca Anindya,
// whose TikTok sits at a median of 0 whatever the hour. And 07:00-10:59 had
// never been tried at all.
//
// How a day is laid out:
//   - Five fixed blocks, BLOCK_STARTS, each BLOCK_MINUTES (3h) long, covering
//     07:00-21:55.
//   - Each account gets ONE offset per day, 0..175 minutes in 5-minute steps
//     (OFFSET_POSITIONS = 36). All of its posts that day sit at
//     blockStart + offset, so its own posts are always exactly 3 hours apart.
//   - Over each 36-day cycle every account uses all 36 offsets exactly once,
//     so every 5-minute position of every block gets sampled evenly.
//
// The offsets are visited in SHUFFLED order, not +5 minutes per day. Walking
// forward one step a day would tie the time of day to the calendar: the
// 07:00 slot would only reach 09:55 in week five, and an account that grew
// over those weeks would make 09:xx look good for reasons that have nothing
// to do with the hour. It is also the pattern this file already moved away
// from once -- the old fixed-increment rotation marched four accounts in a
// perfectly straight line, one minute per day, and resynchronised the whole
// fleet onto the same grid every 10 days.
//
// No two accounts ever post within 5 minutes of each other. Each account owns
// a permanent, unique slotLane (0..35). Each 36-day cycle gets a seeded random
// Latin square, square[dayInCycle][lane] = offset index: every ROW is a
// permutation, so on any day distinct lanes get distinct offsets, and every
// COLUMN is one too, so each lane uses every offset once per cycle. Since
// every post time is blockStart + offset with blocks exactly 180 minutes
// apart, two accounts can only coincide by sharing an offset -- which a row
// of a Latin square rules out. Hence MAX_SLOT_LANES = 36 accounts.
//
// A random square, deliberately, not the cheap structured one
// (values[(rows[day] + lane) mod 36]). That formula satisfies both properties
// too, but it makes every day a rotation of the day before: whatever minutes
// Akun 1 posted at yesterday, Mila Aurel posts at today, Akun 2's go to
// Alya, Akun 3's to Keisha -- the whole fleet shifted by the same five
// lanes. Each account's own timing looks random, but anyone comparing the
// accounts sees them passing one schedule along between them, which is a
// coordination signature on accounts that are already linked.
//
// Everything is derived from the calendar DATE, not from a running counter,
// so a missed build shifts nothing and a re-run for the same day can never
// move an already-queued post.
//
// This module is imported by the admin UI, so it must stay free of server-only
// imports (no db client, no node:crypto).

// FNV-1a, 32-bit. Hand-rolled rather than imported from node:crypto -- see the
// note above about the browser bundle.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast, and good enough to drive a shuffle. Seeded so every
// result here is reproducible for tests and for repeated builds.
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates over 0..n-1.
function seededPermutation(n: number, seed: string): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  const rand = seededRandom(hashSeed(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const BLOCK_STARTS = ["07:00", "10:00", "13:00", "16:00", "19:00"] as const;
export const BLOCK_MINUTES = 180;
export const OFFSET_STEP_MINUTES = 5;
export const OFFSET_POSITIONS = BLOCK_MINUTES / OFFSET_STEP_MINUTES; // 36

// One post per block at most, which is what keeps an account's own posts
// 3 hours apart. Enforced here, in lib/scheduler/validation.ts and by a CHECK
// constraint on scheduler_accounts.posts_per_day.
// Typed as plain numbers: BLOCK_STARTS is `as const`, so its length would
// otherwise leak out as the literal type 5 and reject any other count.
export const MAX_POSTS_PER_DAY: number = BLOCK_STARTS.length; // 5
export const DEFAULT_POSTS_PER_DAY: number = MAX_POSTS_PER_DAY;

// One lane per offset position -- see the collision argument above. Also a
// CHECK constraint (0..35) plus a UNIQUE index on scheduler_accounts.slot_lane.
export const MAX_SLOT_LANES = OFFSET_POSITIONS; // 36

// Warm-up for NEW accounts: 1/day for the first RAMP_PHASE_DAYS, 2/day for the
// next RAMP_PHASE_DAYS, then whatever the account is set to. Brand-new
// accounts posting several times a day is a spam signal, and the three
// YouTube channels banned in August 2026 were all two days old.
export const RAMP_PHASE_DAYS = 30;
export const RAMP_PHASES = 2;

// How many posts this account may publish today: its own posts_per_day
// setting, held back by the warm-up while the account is young.
//
// No rampStartedAt (hand-made rows, anything predating the ramp) means no
// warm-up. rampStartedAt accepts a string as well as a Date because it
// arrives as JSON on the client and as a Date from Drizzle on the server.
export function postsAllowedToday(
  account: { postsPerDay: number; rampStartedAt: Date | string | null },
  now: Date
): number {
  const raw = Number.isFinite(account.postsPerDay) ? Math.floor(account.postsPerDay) : DEFAULT_POSTS_PER_DAY;
  const target = Math.min(Math.max(1, raw), MAX_POSTS_PER_DAY);
  if (!account.rampStartedAt) return target;
  const startedAt = account.rampStartedAt instanceof Date ? account.rampStartedAt : new Date(account.rampStartedAt);
  if (isNaN(startedAt.getTime())) return target;

  const daysLive = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLive >= RAMP_PHASE_DAYS * RAMP_PHASES) return target;
  // Clamped at 1 so a rampStartedAt in the future (a scheduled launch, or
  // clock skew) still posts once a day rather than going silent.
  const phase = Math.max(1, Math.floor(daysLive / RAMP_PHASE_DAYS) + 1);
  return Math.min(phase, target);
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

// Whole days since 1970-01-01 for a "YYYY-MM-DD" calendar date.
function dayNumber(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));
}

// The random Latin square for one cycle: square[dayInCycle][lane] is the
// offset index that lane uses that day.
//
// Built one day (row) at a time as a random perfect matching between lanes
// and the offsets each lane has not used yet this cycle (Kuhn's augmenting
// paths, candidates visited in seeded random order). It can never get stuck:
// before day d every lane has 36 - d unused offsets and every offset is
// unused by 36 - d lanes, a regular bipartite graph, which always has a
// perfect matching (Konig/Hall). Pure and seeded by the cycle number, so the
// server and the browser derive the identical square.
const cycleSquares = new Map<number, number[][]>();
function cycleSquare(cycle: number): number[][] {
  const cached = cycleSquares.get(cycle);
  if (cached) return cached;

  const n = OFFSET_POSITIONS;
  const rand = seededRandom(hashSeed(`slot-cycle:${cycle}`));
  const shuffled = (values: number[]) => {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const all = Array.from({ length: n }, (_, i) => i);
  const usedByLane = Array.from({ length: n }, () => new Set<number>());
  const square: number[][] = [];

  for (let day = 0; day < n; day++) {
    const candidates = all.map((lane) => shuffled(all.filter((o) => !usedByLane[lane].has(o))));
    const ownerOf = new Array<number>(n).fill(-1);
    const offsetOf = new Array<number>(n).fill(-1);
    const assign = (lane: number, visited: boolean[]): boolean => {
      for (const o of candidates[lane]) {
        if (visited[o]) continue;
        visited[o] = true;
        if (ownerOf[o] === -1 || assign(ownerOf[o], visited)) {
          ownerOf[o] = lane;
          offsetOf[lane] = o;
          return true;
        }
      }
      return false;
    };
    for (const lane of shuffled(all)) {
      if (!assign(lane, new Array<boolean>(n).fill(false))) {
        throw new Error(`Gagal menyusun jadwal siklus ${cycle} hari ${day} -- seharusnya mustahil.`);
      }
    }
    offsetOf.forEach((o, lane) => usedByLane[lane].add(o));
    square.push(offsetOf);
  }

  // A cycle lasts 36 days; keeping a handful covers any realistic caller
  // (the build, the admin UI, a year-long verification run) without growing.
  if (cycleSquares.size >= 16) cycleSquares.clear();
  cycleSquares.set(cycle, square);
  return square;
}

// The account's offset for `dateISO`, in minutes (0..175, multiple of 5).
export function dailyOffsetMinutes(slotLane: number, dateISO: string): number {
  if (!Number.isInteger(slotLane) || slotLane < 0 || slotLane >= MAX_SLOT_LANES) {
    throw new Error(`slotLane harus bilangan bulat 0..${MAX_SLOT_LANES - 1}, bukan ${slotLane}.`);
  }
  const day = dayNumber(dateISO);
  const cycle = Math.floor(day / OFFSET_POSITIONS);
  return cycleSquare(cycle)[day - cycle * OFFSET_POSITIONS][slotLane] * OFFSET_STEP_MINUTES;
}

// The account's "HH:mm" posting times for `dateISO`, in clock order.
//
// With fewer than MAX_POSTS_PER_DAY posts the account uses a different subset
// of blocks each day (seeded by account + date), so a 3-a-day account still
// samples every block over time instead of being stuck in the same three.
// The collision guarantee is untouched: it rests on the offset alone.
export function computeDailySlots(account: { id: string; slotLane: number }, count: number, dateISO: string): string[] {
  const n = Math.min(Math.max(0, Math.floor(count)), MAX_POSTS_PER_DAY);
  if (n === 0) return [];
  const offset = dailyOffsetMinutes(account.slotLane, dateISO);
  const blocks = seededPermutation(BLOCK_STARTS.length, `slot-blocks:${account.id}:${dateISO}`)
    .slice(0, n)
    .sort((a, b) => a - b);
  return blocks.map((b) => toHHMM(toMinutes(BLOCK_STARTS[b]) + offset));
}

// Combines a "HH:mm" slot time with a calendar date to get the actual
// scheduledFor instant, in the given IANA timezone. Kept separate from the
// slot math so that stays trivially testable without timezone conversion.
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
