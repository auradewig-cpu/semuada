// Rotation/fatigue verification for the Creative Director fallback. Simulates
// 30 consecutive "auto" generates in one category (picking a hook each time,
// feeding the picks back as usage) and asserts no single hook dominates more
// than ~30% -- the failure mode the plan diagnosed (unpopular_opinion at 75%).
//
//   npx tsx scripts/verify-rotation.ts

import { pickWeighted, type UsageCounts } from "@root/lib/content-generator/rotation";
import { ALL_HOOKS } from "@root/lib/content-generator/creativeDirector";

const N = 30;
const picks: string[] = [];
const usage: UsageCounts = {};

// Seed differs per generate (as the real route does with makeSeed()).
for (let i = 0; i < N; i++) {
  const pick = pickWeighted(ALL_HOOKS, usage, 1000 + i * 31);
  picks.push(pick);
  usage[pick] = (usage[pick] ?? 0) + 1;
}

const counts: Record<string, number> = {};
for (const p of picks) counts[p] = (counts[p] ?? 0) + 1;

console.log("Picks per archetype over", N, "generates:");
for (const h of ALL_HOOKS) {
  const c = counts[h] ?? 0;
  const pct = ((c / N) * 100).toFixed(1);
  console.log(`  ${h.padEnd(20)} ${c} (${pct}%)`);
}

const maxPct = Math.max(...Object.values(counts).map((c) => c / N));
let failed = false;
if (maxPct > 0.3) {
  console.log(`\nFAIL: top archetype dominated at ${(maxPct * 100).toFixed(1)}% (> 30%)`);
  failed = true;
} else {
  console.log(`\nOK: no archetype exceeded 30% (top = ${(maxPct * 100).toFixed(1)}%).`);
}

const distinct = Object.keys(counts).length;
if (distinct < 3) {
  console.log(`FAIL: only ${distinct} distinct archetypes used -- too narrow`);
  failed = true;
}

process.exit(failed ? 1 : 0);
