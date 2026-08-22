// Scheduler rotation verification.
//
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/verify-scheduler-rotation.ts
//
// Read-only: loads the REAL account rows and simulates a year of builds
// against the real computeSlotTimes(), asserting the properties the rotation
// is supposed to have. Written when the linear-increment rotation was replaced
// with hashed jitter (see lib/scheduler/rotation.ts) -- the old scheme passed
// "no collisions" but failed every camouflage property below:
//
//   - four accounts walked a perfect arithmetic progression, +/-1 min per day
//   - accounts sharing an effective step stayed a fixed distance apart forever
//   - all nine reset to their exact base times on the same day every 10 days
//
// It also pins the two config mistakes that used to take the nightly build
// down for every account at once.

import { neon } from "@neondatabase/serverless";
import { computeSlotTimes, MAX_SLOTS_PER_DAY, MIN_DRIFT_WINDOW_MINUTES } from "@root/lib/scheduler/rotation";
import { schedulerAccountRequestSchema } from "@root/lib/scheduler/validation";

const DAYS = 365;
// Worst case with the live config: base times sit 20 minutes apart and the
// window is 10 wide, so two neighbouring accounts can land 20 - 9 = 11 minutes
// apart. The old scheme measured 12, but only because its linear walks never
// happened to select the worst pairing -- that was luck, not a guarantee.
const MIN_GAP_MINUTES = 11;
const EARLIEST_ALLOWED = "03:00"; // build-schedule runs 01:00-02:00 WIB

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n        ${detail}`}`);
  if (!cond) failed = true;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const dayISO = (d: number) => new Date(Date.UTC(2026, 7, 24) + d * 86400000).toISOString().slice(0, 10);

const sql = neon(process.env.DATABASE_URL!);
type Row = { id: string; label: string; base_times: string[]; cap_time: string };
const accounts = (await sql`
  select id, label, base_times, cap_time from scheduler_accounts
  where is_active order by base_times[1]`) as Row[];

console.log(`Simulasi ${DAYS} hari x ${MAX_SLOTS_PER_DAY} fase ramp, ${accounts.length} akun aktif.\n`);

// Slots for one account on one day at one ramp phase. Mirrors
// buildScheduleForAccount(): compute from ALL base times, slice the RESULT.
const slotsFor = (a: Row, d: number, phase: number) =>
  computeSlotTimes(a.base_times, a.cap_time, `${a.id}:${dayISO(d)}`).slice(0, phase);

// --- 1. No collisions, in any ramp phase -------------------------------------
let worstGap = Infinity;
let worstDetail = "";
for (let phase = 1; phase <= MAX_SLOTS_PER_DAY; phase++) {
  for (let d = 0; d < DAYS; d++) {
    const all = accounts.flatMap((a) => slotsFor(a, d, phase).map((t) => ({ label: a.label, min: toMin(t) })));
    all.sort((x, y) => x.min - y.min);
    for (let i = 1; i < all.length; i++) {
      const gap = all[i].min - all[i - 1].min;
      if (gap < worstGap) {
        worstGap = gap;
        worstDetail = `fase ${phase}, ${dayISO(d)}: ${all[i - 1].label} -> ${all[i].label} (${gap} mnt)`;
      }
    }
  }
}
check(`Jarak antar-akun >= ${MIN_GAP_MINUTES} menit`, worstGap >= MIN_GAP_MINUTES, `terkecil ${worstGap} mnt -- ${worstDetail}`);
console.log(`        (terkecil sepanjang tahun: ${worstGap} menit -- ${worstDetail})`);

// --- 2. No arithmetic progression ------------------------------------------
// The old scheme's signature failure: a constant delta between consecutive
// days is a straighter line than posting at a fixed minute would be.
for (const a of accounts) {
  const seq = Array.from({ length: 30 }, (_, d) => toMin(slotsFor(a, d, 1)[0]));
  const deltas = seq.slice(1).map((v, i) => v - seq[i]);
  const constant = deltas.every((x) => x === deltas[0]);
  check(`${a.label}: bukan deret aritmetika`, !constant, `delta konstan ${deltas[0]} mnt/hari`);
}

// --- 3. No two accounts locked at a constant distance ----------------------
for (let i = 0; i < accounts.length; i++) {
  for (let j = i + 1; j < accounts.length; j++) {
    const gaps = Array.from({ length: 60 }, (_, d) => toMin(slotsFor(accounts[j], d, 1)[0]) - toMin(slotsFor(accounts[i], d, 1)[0]));
    const locked = gaps.every((g) => g === gaps[0]);
    check(
      `${accounts[i].label} <-> ${accounts[j].label}: jarak tidak terkunci`,
      !locked,
      `selalu ${gaps[0]} menit terpisah, setiap hari`
    );
  }
}

// --- 4. No fleet-wide resynchronisation day --------------------------------
// The old scheme put every account back on its exact base time whenever the
// day index was a multiple of the window -- 36 tidy :00/:20/:40 days a year.
let syncDays = 0;
for (let d = 0; d < DAYS; d++) {
  const offsets = accounts.map((a) => {
    const latest = Math.max(...a.base_times.map(toMin));
    return toMin(slotsFor(a, d, 1)[0]) - (a.base_times.map(toMin).indexOf(latest) === 0 ? latest : toMin(a.base_times[0]));
  });
  if (offsets.every((o) => o === offsets[0])) syncDays++;
}
check("Tidak ada hari di mana kesembilan akun bergeser serempak", syncDays === 0, `${syncDays} hari serempak dari ${DAYS}`);

// --- 5. Slots stay inside the safe part of the day -------------------------
let earliest = "23:59";
let latest = "00:00";
for (const a of accounts) {
  for (let d = 0; d < DAYS; d++) {
    for (const t of slotsFor(a, d, MAX_SLOTS_PER_DAY)) {
      if (toMin(t) < toMin(earliest)) earliest = t;
      if (toMin(t) > toMin(latest)) latest = t;
      if (toMin(t) >= toMin(a.cap_time)) check(`${a.label}: slot < capTime`, false, `${t} >= ${a.cap_time}`);
    }
  }
}
check(`Tidak ada slot sebelum ${EARLIEST_ALLOWED} (build jalan 01:00-02:00)`, toMin(earliest) >= toMin(EARLIEST_ALLOWED), `paling awal ${earliest}`);
console.log(`        (rentang slot sepanjang tahun: ${earliest} - ${latest})`);

// --- 6. Window is identical across ramp phases, whatever the base order ----
// This is what the slice-the-result change buys. With the old slice-the-input
// version, reordering base_times so the latest one isn't first turned phase 1
// into a 460-minute window and then snapped back on day 30.
for (const a of accounts) {
  const offsetAt = (phase: number) => {
    const slots = computeSlotTimes(a.base_times.slice(0, phase), a.cap_time, `${a.id}:${dayISO(0)}`);
    return toMin(slots[0]) - toMin(a.base_times[0]);
  };
  check(`${a.label}: offset sama di fase 1/2/3`, offsetAt(1) === offsetAt(2) && offsetAt(2) === offsetAt(3), `${offsetAt(1)} / ${offsetAt(2)} / ${offsetAt(3)}`);
}
{
  // Deliberately hostile ordering: priority slot in the middle of the array.
  const shuffled = ["11:30", "19:00", "15:30"];
  const seed = "uji:2026-08-24";
  const full = computeSlotTimes(shuffled, "19:10", seed);
  const offsets = [1, 2, 3].map((n) => toMin(full.slice(0, n)[0]) - toMin(shuffled[0]));
  check(
    "base_times acak: irisan hasil tidak mengubah offset",
    offsets.every((o) => o === offsets[0]),
    `offset per fase: ${offsets.join(" / ")}`
  );
  check("base_times acak: offset tetap di dalam jendela 10 menit", offsets[0] < 10, `offset ${offsets[0]} menit`);
}

// --- 7. Validation pins the two build-killing configs ----------------------
const base = { label: "Uji", category: "Elektronik", base_times: ["19:00", "12:00"], is_active: true };
check("capTime sebelum base terakhir DITOLAK", !schedulerAccountRequestSchema.safeParse({ ...base, cap_time: "18:00" }).success);
check("capTime sama dengan base terakhir DITOLAK", !schedulerAccountRequestSchema.safeParse({ ...base, cap_time: "19:00" }).success);
check(`jendela < ${MIN_DRIFT_WINDOW_MINUTES} menit DITOLAK`, !schedulerAccountRequestSchema.safeParse({ ...base, cap_time: "19:03" }).success);
check(`jendela = ${MIN_DRIFT_WINDOW_MINUTES} menit DITERIMA`, schedulerAccountRequestSchema.safeParse({ ...base, cap_time: "19:05" }).success);

// Every config that is live right now must still validate -- this is the
// easiest place to introduce a regression that locks the admin out of saving.
for (const a of accounts) {
  const parsed = schedulerAccountRequestSchema.safeParse({
    label: a.label, category: "Elektronik", base_times: a.base_times, cap_time: a.cap_time, is_active: true,
  });
  check(`konfigurasi hidup "${a.label}" tetap lolos validasi`, parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
}

console.log(failed ? "\nADA YANG GAGAL" : "\nSEMUA LULUS");
process.exit(failed ? 1 : 0);
