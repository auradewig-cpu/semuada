// Phase 4 verification: primary_action single-clause validator, the AI-look
// scored check, and realism-profile-aware required tokens.
//
//   npx tsx scripts/verify-phase4.ts

import { aiLookScore, validateOutput } from "@root/lib/content-generator/jsonParser";
import { requiredPromptTokens } from "@root/lib/content-generator/promptFragments";
import { resolveRealismProfile } from "@root/lib/content-generator/cinematography";
import type { SceneOutput } from "@root/lib/content-generator/types";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : ` -- ${detail}`}`);
  if (!cond) failed = true;
}

// 1. AI-look scored check.
const cinematicPrompt =
  "A dolly shot with rack focus at golden hour, 8k cinematic lighting with volumetric bokeh and slow motion color grading";
check("AI-look score high on cinematic prompt", aiLookScore(cinematicPrompt) > 3, `score=${aiLookScore(cinematicPrompt)}`);
check("AI-look score low on clean prompt", aiLookScore("handheld shot of the product on a kitchen table") === 0);

// 2. primary_action single-clause validator.
const goodScene: SceneOutput = {
  scene_number: 1,
  duration_seconds: 6,
  speech_pace: "normal",
  script_narration: "Colok powerbank dan lanjut aktivitas.",
  script_word_count: 5,
  visual_description: "A person plugs a power bank.",
  camera_direction: "medium close-up, handheld",
  primary_action: "she plugs in the power bank",
  text_overlay: "HP 3% aja",
  transition_to_next: "next scene",
  ai_ready_prompt: "single continuous shot, shot on a smartphone, no subtitles",
  reference_images: { character: null, character_filename: null, product: "x", product_filename: "g.jpg" },
};
const compoundScene: SceneOutput = { ...goodScene, primary_action: "she plugs in the power bank lalu checks the screen" };

const goodProblems = validateOutput(
  { scenes: [goodScene], caption: "Caption bagus.", hashtags: ["a", "b", "c", "d", "e"] },
  {
    sceneDurations: [6], aiTool: "veo3", characterName: null, productName: "Power bank", category: "Elektronik",
    includePrice: false, narrationWpm: 180, requiredTokens: ["single continuous shot"], sceneNarrationModes: ["voiceover"],
  }
);
check("single-clause primary_action passes", !goodProblems.some((p) => p.includes("primary_action")), JSON.stringify(goodProblems));

const compoundProblems = validateOutput(
  { scenes: [compoundScene], caption: "Caption bagus.", hashtags: ["a", "b", "c", "d", "e"] },
  {
    sceneDurations: [6], aiTool: "veo3", characterName: null, productName: "Power bank", category: "Elektronik",
    includePrice: false, narrationWpm: 180, requiredTokens: ["single continuous shot"], sceneNarrationModes: ["voiceover"],
  }
);
check("compound primary_action ('lalu') caught", compoundProblems.some((p) => p.includes("primary_action")), JSON.stringify(compoundProblems));

// 3. Realism-profile-aware required tokens.
const rawTokens = requiredPromptTokens("veo3", "ugc", "raw_phone");
const commercialTokens = requiredPromptTokens("veo3", "cinematic", "commercial");
check("raw_phone keeps phone token", rawTokens.includes("shot on a smartphone"));
check("commercial drops phone token", !commercialTokens.includes("shot on a smartphone"));
check("both keep single continuous shot", rawTokens.includes("single continuous shot") && commercialTokens.includes("single continuous shot"));

// 4. resolveRealismProfile respects the style's UGC premise.
check("storytime stays creator_ugc by default", resolveRealismProfile("gaul_kekinian", "storytime", "creator_ugc") === "creator_ugc");
check("formal tone lifts to lifestyle", resolveRealismProfile("formal_netral", "direct_response", "creator_ugc") === "lifestyle");

console.log(failed ? "\nVERIFICATION FAILED" : "\nVERIFICATION OK");
process.exit(failed ? 1 : 0);
