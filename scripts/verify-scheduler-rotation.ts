// Scheduler posting-time verification.
//
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/verify-scheduler-rotation.ts
//
// Read-only: loads the REAL account rows and simulates a year of builds
// through the real computeDailySlots(), asserting the properties the
// automatic allocation promises (see lib/scheduler/rotation.ts):
//
//   - no two accounts ever post within 5 minutes of each other -- with the
//     live fleet AND with all 36 lanes taken;
//   - an account's own posts are always 3 hours apart;
//   - every slot falls in 07:00-21:55;
//   - each account uses all 36 offsets exactly once per 36-day cycle, so every
//     hour is sampled evenly -- the whole point, for the posting-hour analysis;
//   - the daily order is shuffled, not a straight +5-minute walk, and no two
//     accounts are locked at a constant distance;
//   - the warm-up and the posts_per_day validation behave.
//
// Ends with a 3-day preview of the real schedule. Works before the migration
// too: without slot_lane it assigns lanes the way the migration will
// (creation order).

import { neon } from "@neondatabase/serverless";
import {
  BLOCK_STARTS,
  computeDailySlots,
  dailyOffsetMinutes,
  MAX_POSTS_PER_DAY,
  MAX_SLOT_LANES,
  OFFSET_POSITIONS,
  OFFSET_STEP_MINUTES,
  postsAllowedToday,
  RAMP_PHASE_DAYS,
  slotTimeToDate,
} from "@root/lib/scheduler/rotation";
import { schedulerAccountRequestSchema } from "@root/lib/scheduler/validation";
import { todayISOInTimezone, TIMEZONE } from "@root/lib/scheduler/buildSchedule";

const DAYS = 365;
const MIN_GAP_MINUTES = OFFSET_STEP_MINUTES;
const OWN_GAP_MINUTES = 180;
const FIRST_ALLOWED = "07:00";
const LAST_ALLOWED = "21:55";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n        ${detail}`}`);
  if (!cond) failed = true;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const today = todayISOInTimezone(TIMEZONE);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);

type Acc = { id: string; label: string; slotLane: number; postsPerDay: number };
const sql = neon(process.env.DATABASE_URL!);
let accounts: Acc[];
try {
  const rows = (await sql`select id, label, slot_lane, posts_per_day from scheduler_accounts where is_active order by slot_lane`) as {
    id: string; label: string; slot_lane: number; posts_per_day: number;
  }[];
  accounts = rows.map((r) => ({ id: r.id, label: r.label, slotLane: r.slot_lane, postsPerDay: r.posts_per_day }));
  console.log(`${accounts.length} akun aktif (slot_lane dari database).`);
} catch {
  const rows = (await sql`select id, label, is_active from scheduler_accounts order by created_at, id`) as {
    id: string; label: string; is_active: boolean;
  }[];
  accounts = rows
    .map((r, i) => ({ id: r.id, label: r.label, slotLane: i, postsPerDay: MAX_POSTS_PER_DAY, active: r.is_active }))
    .filter((r) => r.active);
  console.log(`${accounts.length} akun aktif (belum dimigrasi -- slot_lane disimulasikan urut created_at).`);
}
console.log(`Simulasi ${DAYS} hari mulai ${today}.\n`);

const days = Array.from({ length: DAYS }, (_, d) => addDays(today, d));

// --- 1. Cross-account spacing ------------------------------------------------
function worstCrossGap(fleet: Acc[], count: (a: Acc) => number) {
  let worst = Infinity;
  let detail = "";
  for (const day of days) {
    const all = fleet.flatMap((a) => computeDailySlots(a, count(a), day).map((t) => ({ label: a.label, min: toMin(t) })));
    all.sort((x, y) => x.min - y.min);
    for (let i = 1; i < all.length; i++) {
      if (all[i].label === all[i - 1].label) continue;
      const gap = all[i].min - all[i - 1].min;
      if (gap < worst) {
        worst = gap;
        detail = `${day}: ${all[i - 1].label} -> ${all[i].label} (${gap} mnt)`;
      }
    }
  }
  return { worst, detail };
}
{
  const live = worstCrossGap(accounts, () => MAX_POSTS_PER_DAY);
  check(`Akun asli, 5x/hari: jarak antar-akun >= ${MIN_GAP_MINUTES} menit`, live.worst >= MIN_GAP_MINUTES, live.detail);
  console.log(`        (terkecil sepanjang tahun: ${live.worst} menit -- ${live.detail})`);

  const full = Array.from({ length: MAX_SLOT_LANES }, (_, i) => ({ id: `uji-${i}`, label: `Lane ${i}`, slotLane: i, postsPerDay: 5 }));
  const fullGap = worstCrossGap(full, () => MAX_POSTS_PER_DAY);
  check(`${MAX_SLOT_LANES} lane penuh, 5x/hari: jarak antar-akun >= ${MIN_GAP_MINUTES} menit`, fullGap.worst >= MIN_GAP_MINUTES, fullGap.detail);

  const mixed = worstCrossGap(full, (a) => 1 + (a.slotLane % MAX_POSTS_PER_DAY));
  check(`${MAX_SLOT_LANES} lane, jumlah posting campur 1-5: tetap >= ${MIN_GAP_MINUTES} menit`, mixed.worst >= MIN_GAP_MINUTES, mixed.detail);
}

// --- 2. An account's own posts are 3 hours apart, at every count -------------
{
  let worst = Infinity;
  let detail = "";
  for (const a of accounts) {
    for (let n = 2; n <= MAX_POSTS_PER_DAY; n++) {
      for (const day of days) {
        const slots = computeDailySlots(a, n, day).map(toMin);
        for (let i = 1; i < slots.length; i++) {
          const gap = slots[i] - slots[i - 1];
          if (gap < worst) {
            worst = gap;
            detail = `${a.label} ${n}x ${day}: ${gap} mnt`;
          }
        }
      }
    }
  }
  check(`Jarak antar post satu akun >= ${OWN_GAP_MINUTES} menit`, worst >= OWN_GAP_MINUTES, detail);
}

// --- 3. Every slot inside 07:00-21:55, right count, clock order --------------
{
  let earliest = "23:59";
  let latest = "00:00";
  let badCount = "";
  let unordered = "";
  for (const a of accounts) {
    for (let n = 0; n <= MAX_POSTS_PER_DAY; n++) {
      for (const day of days) {
        const slots = computeDailySlots(a, n, day);
        if (slots.length !== n) badCount = `${a.label} ${n}x ${day}: dapat ${slots.length}`;
        if (slots.some((t, i) => i > 0 && toMin(t) <= toMin(slots[i - 1]))) unordered = `${a.label} ${day}: ${slots.join(",")}`;
        for (const t of slots) {
          if (toMin(t) < toMin(earliest)) earliest = t;
          if (toMin(t) > toMin(latest)) latest = t;
        }
      }
    }
  }
  check(`Semua slot di ${FIRST_ALLOWED}-${LAST_ALLOWED}`, toMin(earliest) >= toMin(FIRST_ALLOWED) && toMin(latest) <= toMin(LAST_ALLOWED), `${earliest} - ${latest}`);
  console.log(`        (rentang sepanjang tahun: ${earliest} - ${latest})`);
  check("Jumlah slot sesuai permintaan (0..5)", badCount === "", badCount);
  check("Slot urut jam", unordered === "", unordered);
  check(`Jumlah posting di atas ${MAX_POSTS_PER_DAY} dipotong ke ${MAX_POSTS_PER_DAY}`, computeDailySlots(accounts[0], 9, today).length === MAX_POSTS_PER_DAY);
}

// --- 4. Each lane uses all 36 offsets exactly once per cycle -----------------
{
  const firstCycleStart = Math.ceil(dayNumber(today) / OFFSET_POSITIONS) * OFFSET_POSITIONS;
  let bad = "";
  for (let c = 0; c < 10 && !bad; c++) {
    for (let lane = 0; lane < MAX_SLOT_LANES && !bad; lane++) {
      const seen = new Set<number>();
      for (let p = 0; p < OFFSET_POSITIONS; p++) {
        const iso = new Date((firstCycleStart + c * OFFSET_POSITIONS + p) * 86400000).toISOString().slice(0, 10);
        seen.add(dailyOffsetMinutes(lane, iso));
      }
      if (seen.size !== OFFSET_POSITIONS) bad = `siklus ${c}, lane ${lane}: hanya ${seen.size} offset berbeda`;
    }
  }
  check(`Tiap lane memakai ${OFFSET_POSITIONS} offset tepat sekali per siklus (10 siklus x ${MAX_SLOT_LANES} lane)`, bad === "", bad);

  // Which translates into every hour being sampled equally at 5x/day.
  const start = new Date(firstCycleStart * 86400000).toISOString().slice(0, 10);
  let uneven = "";
  for (const a of accounts) {
    const perHour = new Map<number, number>();
    for (let p = 0; p < OFFSET_POSITIONS; p++) {
      for (const t of computeDailySlots(a, MAX_POSTS_PER_DAY, addDays(start, p))) {
        const h = Math.floor(toMin(t) / 60);
        perHour.set(h, (perHour.get(h) ?? 0) + 1);
      }
    }
    const counts = [...perHour.values()];
    if (perHour.size !== 15 || counts.some((n) => n !== counts[0])) {
      uneven = `${a.label}: ${[...perHour.entries()].map(([h, n]) => `${h}h=${n}`).join(" ")}`;
      break;
    }
  }
  check("5x/hari: tiap jam 07-21 kebagian sama rata dalam satu siklus", uneven === "", uneven);
}

// --- 5. Shuffled, not a +5 walk; no two accounts locked together -------------
for (const a of accounts) {
  const seq = days.slice(0, OFFSET_POSITIONS).map((d) => dailyOffsetMinutes(a.slotLane, d));
  const deltas = new Set(seq.slice(1).map((v, i) => v - seq[i]));
  check(`${a.label}: urutan geser acak, bukan langkah tetap`, deltas.size >= 10, `hanya ${deltas.size} selisih berbeda`);
}
{
  let locked = "";
  for (let i = 0; i < accounts.length && !locked; i++) {
    for (let j = i + 1; j < accounts.length && !locked; j++) {
      const gaps = days.slice(0, 60).map((d) => dailyOffsetMinutes(accounts[j].slotLane, d) - dailyOffsetMinutes(accounts[i].slotLane, d));
      if (gaps.every((g) => g === gaps[0])) locked = `${accounts[i].label} <-> ${accounts[j].label}: selalu ${gaps[0]} mnt`;
    }
  }
  check("Tidak ada dua akun dengan jarak terkunci", locked === "", locked);
}
{
  // Today's schedule must not be yesterday's passed along between accounts.
  // The structured construction (values[(rows[day] + lane) mod 36]) failed
  // exactly this: every day was the previous one rotated by a fixed number of
  // lanes, so the minutes one account used yesterday reappeared on another
  // account today, the same shift for the whole fleet. Measured with all 36
  // lanes so every day has plenty of overlaps to compare.
  let structured = 0;
  let considered = 0;
  for (let d = 1; d < DAYS; d++) {
    const yesterday = new Map<number, number>();
    for (let lane = 0; lane < MAX_SLOT_LANES; lane++) yesterday.set(dailyOffsetMinutes(lane, days[d - 1]), lane);
    const shifts: number[] = [];
    for (let lane = 0; lane < MAX_SLOT_LANES; lane++) {
      const from = yesterday.get(dailyOffsetMinutes(lane, days[d]));
      if (from !== undefined && from !== lane) shifts.push((((from - lane) % MAX_SLOT_LANES) + MAX_SLOT_LANES) % MAX_SLOT_LANES);
    }
    if (shifts.length >= 3) {
      considered++;
      const mostCommon = Math.max(...[...new Set(shifts)].map((s) => shifts.filter((x) => x === s).length));
      if (mostCommon / shifts.length > 0.5) structured++;
    }
  }
  check(
    "Jadwal hari ini bukan rotasi jadwal kemarin antar-akun",
    considered > 0 && structured === 0,
    `${structured} dari ${considered} hari punya pergeseran seragam antar-akun`
  );
}

// --- 6. Fewer than 5 posts: the blocks rotate too ------------------------------
for (const n of [1, 3]) {
  const a = accounts[0];
  const used = new Map<number, number>();
  const subsets = new Set<string>();
  for (const day of days.slice(0, 60)) {
    const slots = computeDailySlots(a, n, day);
    const blocks = slots.map((t) => BLOCK_STARTS.findIndex((b, k) => toMin(t) >= toMin(b) && (k === BLOCK_STARTS.length - 1 || toMin(t) < toMin(BLOCK_STARTS[k + 1]))));
    subsets.add(blocks.join(","));
    for (const b of blocks) used.set(b, (used.get(b) ?? 0) + 1);
  }
  check(`${n}x/hari: semua ${BLOCK_STARTS.length} blok terpakai dalam 60 hari`, used.size === BLOCK_STARTS.length, `hanya blok ${[...used.keys()].join(",")}`);
  check(`${n}x/hari: kombinasi blok berganti-ganti`, subsets.size >= Math.min(5, n === 1 ? 5 : 10), `${subsets.size} kombinasi`);
}

// --- 7. Deterministic --------------------------------------------------------
{
  const a = accounts[0];
  const same = days.slice(0, 30).every((d) => computeDailySlots(a, 5, d).join() === computeDailySlots(a, 5, d).join());
  check("Deterministik: input sama -> jam sama", same);
  let threw = false;
  try { dailyOffsetMinutes(MAX_SLOT_LANES, today); } catch { threw = true; }
  check(`slot_lane di luar 0..${MAX_SLOT_LANES - 1} ditolak`, threw);
}

// --- 8. Warm-up ----------------------------------------------------------------
{
  const now = new Date("2026-11-08T00:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  const cases: [string, number | string | null, number, number][] = [
    ["hari 0", 0, 5, 1],
    ["hari 29", 29, 5, 1],
    ["hari 30", 30, 5, 2],
    ["hari 59", 59, 5, 2],
    ["hari 60", 60, 5, 5],
    ["hari 88", 88, 5, 5],
    ["hari 60, setelan 3", 60, 3, 3],
    ["hari 35, setelan 1", 35, 1, 1],
    ["tanpa ramp", null, 5, 5],
    ["tanggal masa depan", -10, 5, 1],
    ["string ISO", "string", 5, 5],
    ["setelan 9 dipotong", null, 9, 5],
    ["setelan 0 dinaikkan", null, 0, 1],
  ];
  for (const [name, d, target, expected] of cases) {
    const rampStartedAt = d === null ? null : d === "string" ? ago(70).toISOString() : ago(d as number);
    const got = postsAllowedToday({ postsPerDay: target, rampStartedAt }, now);
    check(`Pemanasan: ${name} -> ${expected}x`, got === expected, `dapat ${got}`);
  }
  check(`RAMP_PHASE_DAYS = 30`, RAMP_PHASE_DAYS === 30);
}

// --- 9. Validation -----------------------------------------------------------
{
  const base = { label: "Uji", category: "Elektronik", is_active: true };
  const ok = (v: unknown) => schedulerAccountRequestSchema.safeParse({ ...base, posts_per_day: v }).success;
  check("posts_per_day 1 dan 5 DITERIMA", ok(1) && ok(5));
  check("posts_per_day 0 dan 6 DITOLAK", !ok(0) && !ok(6));
  check("posts_per_day 2.5 DITOLAK", !ok(2.5));
  const absent = schedulerAccountRequestSchema.safeParse(base);
  check(
    "posts_per_day absen = tidak diubah (tanpa default di zod)",
    absent.success && absent.data.posts_per_day === undefined,
    JSON.stringify(absent.success ? absent.data : absent.error.issues)
  );
  const legacy = schedulerAccountRequestSchema.safeParse({ ...base, base_times: ["19:00"], cap_time: "19:10" });
  check("Klien lama yang masih kirim base_times/cap_time tetap lolos", legacy.success);
}

// --- 10. Timezone conversion ---------------------------------------------------
check("slotTimeToDate: 07:35 WIB = 00:35 UTC", slotTimeToDate("2026-11-08", "07:35", TIMEZONE).toISOString() === "2026-11-08T00:35:00.000Z");

// --- Preview -------------------------------------------------------------------
console.log("\nPratinjau 3 hari ke depan (5x/hari, sebelum pemanasan/stok):");
for (let d = 1; d <= 3; d++) {
  const day = addDays(today, d);
  console.log(`\n  ${day}`);
  for (const a of accounts) {
    const slots = computeDailySlots(a, Math.min(a.postsPerDay, MAX_POSTS_PER_DAY), day);
    console.log(`    ${a.label.padEnd(18)} +${String(dailyOffsetMinutes(a.slotLane, day)).padStart(3)} mnt  ${slots.join("  ")}`);
  }
}

console.log(failed ? "\nADA YANG GAGAL" : "\nSEMUA LULUS");
process.exit(failed ? 1 : 0);
