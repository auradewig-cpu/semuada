// Per-account video lane verification.
//
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/verify-video-lanes.ts
//
// Exercises the REAL claimNextVideos() -- the function the nightly build calls
// -- rather than a reimplementation of its rules.
//
// claimNextVideos MUTATES (it sets status='scheduled'), so this cannot run
// against live rows. It creates its own throwaway videos in a category no
// scheduler account is configured for, so a concurrent real build can never see
// them, and deletes them in a finally block.
//
// The property under test: a video reserved for account A must NEVER be claimed
// by account B -- not even when B's own lane is empty and the shared pool is
// dry. That is the entire reason lanes exist; if it leaks, one account's run of
// near-identical videos surfaces on a sibling account and both get flagged.

import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, videoContents } from "@shared/schema";
import { claimNextVideos } from "@root/lib/scheduler/videoPool";

const TEST_CATEGORY = "__LANE_TEST__";
const MARKER = "LANE-TEST-";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n        ${detail}`}`);
  if (!cond) failed = true;
}

async function cleanup() {
  await db.delete(videoContents).where(like(videoContents.cloudinaryPublicId, `${MARKER}%`));
}

async function seed(rows: Array<{ tag: string; lane: string | null; minutesOld: number }>) {
  const values = rows.map((r) => ({
    category: TEST_CATEGORY,
    videoUrl: `https://example.invalid/${r.tag}.mp4`,
    cloudinaryPublicId: `${MARKER}${r.tag}`,
    schedulerAccountId: r.lane,
    status: "uploaded",
    // Explicit createdAt so FIFO order is deterministic rather than dependent
    // on insert timing.
    createdAt: new Date(Date.now() - r.minutesOld * 60_000),
  }));
  return db.insert(videoContents).values(values).returning();
}

const tagOf = (v: { cloudinaryPublicId: string }) => v.cloudinaryPublicId.replace(MARKER, "");

try {
  await cleanup(); // in case a previous run died mid-way

  const accounts = await db.select().from(schedulerAccounts).where(eq(schedulerAccounts.isActive, true));
  const [A, B] = accounts;
  if (!A || !B) throw new Error("Butuh minimal 2 akun aktif untuk menguji isolasi.");
  console.log(`Akun uji: A="${A.label}"  B="${B.label}"\n`);

  // --- 1. Lane isolation, the core property -----------------------------
  // A owns 3 videos. B owns nothing and the shared pool is empty.
  await seed([
    { tag: "a1", lane: A.id, minutesOld: 30 },
    { tag: "a2", lane: A.id, minutesOld: 20 },
    { tag: "a3", lane: A.id, minutesOld: 10 },
  ]);

  const bGot = await claimNextVideos(B.id, TEST_CATEGORY, 3);
  check(
    "video di wadah A TIDAK bisa diklaim B (wadah B kosong, kolam bersama kosong)",
    bGot.length === 0,
    `B malah dapat: ${bGot.map(tagOf).join(", ")}`
  );

  // --- 2. FIFO inside the lane -----------------------------------------
  const aGot = await claimNextVideos(A.id, TEST_CATEGORY, 2);
  check(
    "A mengambil dari wadahnya sendiri, FIFO (terlama dulu)",
    aGot.map(tagOf).join(",") === "a1,a2",
    `dapat: ${aGot.map(tagOf).join(", ")} (harusnya a1,a2)`
  );
  await cleanup();

  // --- 3. Fallback to the shared pool ------------------------------------
  // B's lane is empty, but the category has unassigned stock.
  await seed([
    { tag: "shared1", lane: null, minutesOld: 30 },
    { tag: "shared2", lane: null, minutesOld: 20 },
    { tag: "a-locked", lane: A.id, minutesOld: 40 },
  ]);

  const bFallback = await claimNextVideos(B.id, TEST_CATEGORY, 3);
  check(
    "wadah B kosong -> ambil dari kolam bersama, dan TIDAK menyentuh wadah A",
    bFallback.map(tagOf).sort().join(",") === "shared1,shared2",
    `dapat: ${bFallback.map(tagOf).join(", ")}`
  );
  check(
    "video milik A tetap 'uploaded' setelah B mengambil",
    (await db.select().from(videoContents).where(eq(videoContents.cloudinaryPublicId, `${MARKER}a-locked`)))[0]?.status === "uploaded",
    "video A ikut terklaim B"
  );
  await cleanup();

  // --- 4. Lane first, then top up from the shared pool -------------------
  await seed([
    { tag: "a-own", lane: A.id, minutesOld: 10 },
    { tag: "pool-old", lane: null, minutesOld: 60 },
  ]);
  const mixed = await claimNextVideos(A.id, TEST_CATEGORY, 2);
  check(
    "wadah didahulukan walau kolam bersama punya video lebih lama",
    mixed.map(tagOf).join(",") === "a-own,pool-old",
    `dapat: ${mixed.map(tagOf).join(", ")} (harusnya a-own dulu)`
  );
  await cleanup();

  // --- 5. Two accounts claiming at once never share a row ---------------
  await seed(Array.from({ length: 6 }, (_, i) => ({ tag: `race${i}`, lane: null, minutesOld: 60 - i })));
  const [r1, r2] = await Promise.all([
    claimNextVideos(A.id, TEST_CATEGORY, 3),
    claimNextVideos(B.id, TEST_CATEGORY, 3),
  ]);
  const overlap = r1.filter((v) => r2.some((w) => w.id === v.id));
  check("klaim bersamaan tidak pernah menghasilkan baris yang sama", overlap.length === 0, `${overlap.length} baris tumpang tindih`);
  check("keduanya tetap kebagian", r1.length + r2.length === 6, `${r1.length} + ${r2.length}`);
  await cleanup();

  // --- 6. Cross-category lane is never drained --------------------------
  // Defensive: a lane row whose category doesn't match the account must not be
  // claimed, even though the API refuses to create one.
  await seed([{ tag: "wrongcat", lane: A.id, minutesOld: 10 }]);
  const wrong = await claimNextVideos(A.id, "Kategori Yang Berbeda", 1);
  check("wadah dengan kategori tidak cocok tidak ikut terklaim", wrong.length === 0, `dapat: ${wrong.map(tagOf).join(", ")}`);
} finally {
  await cleanup();
  const leftover = await db
    .select({ id: videoContents.id })
    .from(videoContents)
    .where(and(like(videoContents.cloudinaryPublicId, `${MARKER}%`)));
  console.log(`\nBersih-bersih: ${leftover.length === 0 ? "tidak ada sisa data uji" : `${leftover.length} BARIS TERSISA`}`);
  if (leftover.length > 0) failed = true;
}

console.log(failed ? "\nADA YANG GAGAL" : "\nSEMUA LULUS");
process.exit(failed ? 1 : 0);
