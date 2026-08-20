// Prompt size + category-differentiation verifier for the Content Generator
// refactor. Compiles the REAL Stage B prompt for several realistic inputs and
// checks:
//   1. character length stays under the 17,659 baseline,
//   2. word count and number of "WAJIB" mandates are printed,
//   3. a Handphone prompt and a Kecantikan prompt genuinely use different
//      shot sizes / environments (substring asserts, not eyeballing).
//
//   npx tsx scripts/verify-prompt-size.ts
//
// Fails (exit 1) if any check trips, so it can gate a deploy.

import { compileMasterPrompt } from "@root/lib/content-generator/masterPrompt";
import { getCategoryBible } from "@root/lib/content-generator/categoryCreative";
import type { MasterPromptInput } from "@root/lib/content-generator/masterPrompt";

const BASELINE_CHARS = 17659;

// The configuration the 17,659 baseline was ACTUALLY measured on, taken from
// what content_generations shows the user really generates: vlog_daily (143x)
// + growth (303x) + follow_more (293x) + unpopular_opinion (228x) +
// gaul_kekinian, veo3, faceless, Shopee, THREE 8s scenes.
//
// An earlier version of this gate used direct_response + conversion + 2 scenes
// while claiming to be that baseline. Two scenes emit one fewer per-scene
// direction block (~1kB), so the gate passed while the real most-used path had
// regressed past the limit -- the exact failure the gate exists to prevent.
function baseInput(over: Partial<MasterPromptInput>): MasterPromptInput {
  return {
    productName: "Cetaphil Bright Healthy Radiance Reveal Creamy Cleanser 100g",
    category: "Perawatan & Kecantikan",
    price: "386900",
    productFactsLine:
      'FAKTA PRODUK (hanya ini yang boleh dikutip angka/faktanya -- JANGAN mengarang harga, jumlah terjual, rating, ukuran, atau spesifikasi lain): Harga Rp 386900; Sudah terjual 1000; Rating 4.9; Dikirim dari KOTA TANGERANG.',
    scenes: [
      { imageUrl: "https://x.test/a.jpg", duration: 8, narrationMode: null, cameraPattern: null },
      { imageUrl: "https://x.test/b.jpg", duration: 8, narrationMode: null, cameraPattern: null },
      { imageUrl: "https://x.test/c.jpg", duration: 8, narrationMode: null, cameraPattern: null },
    ],
    style: "vlog_daily",
    aiTool: "veo3",
    platform: "shopee_video",
    aspectRatio: "9:16",
    hookArchetype: "unpopular_opinion",
    contentGoal: "growth",
    ctaType: "follow_more",
    languageTone: "gaul_kekinian",
    characterName: null,
    characterDescription: null,
    narrationWpm: 120,
    includePrice: true,
    narrationMode: "lipsync",
    cameraPattern: "single_angle",
    narratorVoice: "wanita",
    seed: 42,
    ...over,
  };
}

// The brief path is what production actually runs (every selector defaults to
// "auto"), so it is the case the gate must judge -- not the fallback path.
const SAMPLE_BRIEF = {
  mechanism: "texture_reveal",
  environment: "kamar mandi rumah biasa, pagi hari",
  reasoning: "Produk pembersih wajah paling meyakinkan lewat tekstur dan aplikasi nyata.",
  scene_plan: [
    { scene_number: 1, beat: "kulit terasa kusam", primary_action: "she looks at her face in the mirror" },
    { scene_number: 2, beat: "aplikasi produk", primary_action: "she pumps the cleanser onto her palm" },
    { scene_number: 3, beat: "hasil terasa segar", primary_action: "she pats her face dry with a towel" },
  ],
};

function stats(prompt: string) {
  const chars = prompt.length;
  const words = prompt.split(/\s+/).filter(Boolean).length;
  const wajib = (prompt.match(/WAJIB/g) || []).length;
  const jangan = (prompt.match(/JANGAN|DILARANG/g) || []).length;
  return { chars, words, wajib, jangan };
}

let failed = false;

function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : ` -- ${detail}`}`);
  if (!cond) failed = true;
}

// Production path: brief present (all selectors default to "auto").
const kecantikan = compileMasterPrompt(baseInput({ creativeBrief: SAMPLE_BRIEF }));
const handphone = compileMasterPrompt(
  baseInput({
    category: "Handphone & Aksesoris",
    productName: "Powerbank 20000mAh fast charging",
    creativeBrief: { ...SAMPLE_BRIEF, mechanism: "battery_emergency", environment: "kamar kos, malam hari" },
  })
);
const tasPria = compileMasterPrompt(
  baseInput({ category: "Tas Pria", productName: "Tas ransel kulit sintetis", creativeBrief: SAMPLE_BRIEF })
);
// Fallback path: Stage A failed, rotation picked the values, no brief.
const noBrief = compileMasterPrompt(baseInput({}));

const hpStats = stats(handphone);
const kecStats = stats(kecantikan);
const tasStats = stats(tasPria);
const noBriefStats = stats(noBrief);

console.log("--- Perawatan & Kecantikan (dengan brief) ---");
console.log(kecStats);
console.log("--- Handphone & Aksesoris (dengan brief) ---");
console.log(hpStats);
console.log("--- Tas Pria (GENERIC_BIBLE fallback, dengan brief) ---");
console.log(tasStats);
console.log("--- tanpa brief (jalur fallback Stage A gagal) ---");
console.log(noBriefStats);

// 1. The STRUCTURAL prompt (everything that isn't the brief's per-scene
//    payload) must stay at or under the pre-refactor baseline. This is the
//    "replace, don't stack" rule: the Category Bible, realism profile and
//    FAKTA PRODUK all had to pay for themselves by removing something else.
check("tanpa brief <= baseline", noBriefStats.chars <= BASELINE_CHARS, `${noBriefStats.chars} > ${BASELINE_CHARS}`);

// 2. The brief HEADER (mechanism + environment) must not cost anything: it
//    replaces the category environment menu and folds its scene plan into the
//    existing per-scene block, so it should come out net-neutral or cheaper.
const briefHeaderOnly = compileMasterPrompt(baseInput({ creativeBrief: { ...SAMPLE_BRIEF, scene_plan: [] } }));
check(
  "header brief tidak menambah beban",
  briefHeaderOnly.length <= noBriefStats.chars,
  `${briefHeaderOnly.length} > ${noBriefStats.chars} -- blok brief menumpuk, bukan mengganti`
);

// 3. The only growth the brief is allowed is its per-scene beat + dominant
//    action -- that IS the Phase 4 feature and nothing else in the prompt
//    carries it, so it cannot be "replaced". Bounded per scene so a future
//    regression in the structural part can't hide inside this allowance.
const PER_SCENE_ALLOWANCE = 160;
const sceneCount = 3;
const ceiling = BASELINE_CHARS + sceneCount * PER_SCENE_ALLOWANCE;
for (const [label, s] of [["Kecantikan", kecStats], ["Handphone", hpStats], ["Tas Pria", tasStats]] as const) {
  check(`${label} (brief) <= baseline + ${sceneCount}x${PER_SCENE_ALLOWANCE}`, s.chars <= ceiling, `${s.chars} > ${ceiling}`);
}

// 4. Instruction competition is the thing the size limit is really a proxy for
//    -- this module's known failure mode is a rule being silently dropped when
//    too many mandates compete. Cap it explicitly.
const MAX_WAJIB = 26;
for (const [label, s] of [["Kecantikan", kecStats], ["Handphone", hpStats], ["tanpa brief", noBriefStats]] as const) {
  check(`${label}: WAJIB <= ${MAX_WAJIB}`, s.wajib <= MAX_WAJIB, `${s.wajib} > ${MAX_WAJIB}`);
}

// 2. Category differentiation -- the two bibles must produce visibly different
//    shot-size / environment vocabulary in the compiled prompt.
const hpBible = getCategoryBible("Handphone & Aksesoris");
const kecBible = getCategoryBible("Perawatan & Kecantikan");

check(
  "Handphone shot size present",
  handphone.includes(hpBible.visual.shotSizes[0]),
  `expected "${hpBible.visual.shotSizes[0]}"`
);
check(
  "Kecantikan shot size present",
  kecantikan.includes(kecBible.visual.shotSizes[0]),
  `expected "${kecBible.visual.shotSizes[0]}"`
);
check(
  "Handphone vs Kecantikan environments differ",
  hpBible.visual.environments.join("|") !== kecBible.visual.environments.join("|"),
  "bibles share the same environments"
);
check(
  "Handphone prompt does not leak Kecantikan environment",
  !handphone.includes(kecBible.visual.environments[0]),
  `leaked "${kecBible.visual.environments[0]}"`
);

// 3. Small category (Tas Pria) still produces a valid prompt via GENERIC_BIBLE.
check("Tas Pria prompt non-empty", tasPria.length > 1000, "prompt too short");

console.log(failed ? "\nVERIFICATION FAILED" : "\nVERIFICATION OK");
process.exit(failed ? 1 : 0);
