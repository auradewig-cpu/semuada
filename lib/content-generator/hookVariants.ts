import { getContentStyle } from "./contentStyles";
import { HOOK_ARCHETYPES } from "./hookPatterns";
import { getAiToolSpec } from "./aiTools";
import { getPlatformSpec, buildPlatformBehavior } from "./platforms";
import { getLanguageTone, buildLanguageToneRule } from "./languageTones";
import { buildCinematographyRule, buildSingleTakeRule } from "./cinematography";
import { buildNegativePromptBlock, buildSpokenNumberRule } from "./negativePrompt";
import {
  buildCharacterBlock,
  buildDialogueRule,
  buildProductAnchorRule,
  buildProductPriceLine,
  buildPriceRule,
  buildCameraPatternRule,
  buildDeliveryTechniqueRule,
  buildPromptBudgetRule,
  buildRealismRule,
  buildBannedClaimsRule,
  buildDurationMarkerRule,
  buildWordCountSelfCheckRule,
} from "./promptFragments";
import type { AiToolId, AspectRatio, CameraPattern, ContentGoal, ContentStyleId, HookArchetype, LanguageTone, NarrationMode, PlatformTarget, SceneOutput } from "./types";

export interface HookVariantsInput {
  productName: string;
  category: string;
  price: string;
  sceneDuration: number;
  productImageUrl: string;
  currentScene: SceneOutput;
  currentArchetype: HookArchetype;
  languageTone: LanguageTone;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  // Previously absent, which forced the route to hardcode "conversion" when
  // policy-checking the variants -- so a growth-mode video's hook variants were
  // never screened against the no-hard-sell rules.
  contentGoal: ContentGoal;
  characterName: string | null;
  characterDescription: string | null;
  narrationWpm: number;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
  variantCount?: number;
  seed: number;
  // Same anti-repetition history the main generate flow gets. Variants exist
  // precisely to produce novelty, so this is the one builder that most needs it.
  avoidRepetitionBlock?: string;
}

export interface HookVariantsOutput {
  variants: SceneOutput[];
}

// Ported concept from ViralFrame Studio's hookVariator.ts -- generates N
// alternate scene-1 hooks, each forced into a DIFFERENT archetype than the
// current one and from each other, so the user can A/B pick. 2026 research:
// "ship 4-6 hook variants, kill anything below 25% retention" is standard
// practice -- this gives the raw material for that workflow.
export function compileHookVariantsPrompt(input: HookVariantsInput): string {
  const variantCount = input.variantCount ?? 3;
  const style = getContentStyle(input.style);
  const toolSpec = getAiToolSpec(input.aiTool);
  const platformSpec = getPlatformSpec(input.platform);
  const hasCharacter = input.characterName !== null;
  const toneSpec = getLanguageTone(input.languageTone);

  const availableArchetypes = Object.values(HOOK_ARCHETYPES).filter((a) => a.id !== input.currentArchetype);
  const archetypeList = availableArchetypes.map((a) => `- ${a.id}: ${a.instruction}`).join("\n");

  const characterBlock = buildCharacterBlock(input.characterName, input.characterDescription);
  const dialogueRule = buildDialogueRule(input.aiTool, input.narrationMode, hasCharacter);
  const productAnchorRule = buildProductAnchorRule(input.productName, input.category);
  const priceLine = buildProductPriceLine(input.price, input.includePrice);
  // Scene 1 is a hook, not the CTA beat -- a mandatory price here would fight
  // the hook's job. Kept permissive regardless of the toggle's strength.
  const priceRule = buildPriceRule(false, undefined, input.contentGoal);
  const cameraPatternRule = buildCameraPatternRule(input.cameraPattern);

  const negativeBlock = buildNegativePromptBlock({
    // Variants are mutually exclusive ALTERNATIVES of the same scene, not a
    // sequence -- cross-scene consistency rules are semantically wrong here and
    // directly fight "each variant must differ".
    sceneCount: 1,
    allowsVisualChange: style.allowsVisualChange,
    supportsNegativePromptField: toolSpec.supportsNegativePrompt,
  });

  const negativePromptField = toolSpec.supportsNegativePrompt ? `, "negative_prompt"` : "";

  return `
Kamu membuat ${variantCount} VARIASI HOOK untuk scene 1 dari sebuah video affiliate produk, masing-masing memakai teknik hook BERBEDA.

PRODUK: ${input.productName} (${input.category})${priceLine ? `, ${priceLine.replace(/^- /, '')}` : ''}
${characterBlock}

GAYA VIDEO: ${style.label}
- Instruksi nada bicara: ${style.narrativeVoiceGuidance}
- Instruksi kamera: ${style.cameraInstruction}

${buildLanguageToneRule(input.languageTone, input.seed)}

${buildDeliveryTechniqueRule()}

PLATFORM: ${platformSpec.label} (rasio ${input.aspectRatio}) -- ${buildPlatformBehavior(input.platform, input.includePrice)}
AI VIDEO TOOL: ${toolSpec.label} (satu scene maksimal ~${toolSpec.maxDurationSeconds}s). Format: ${toolSpec.formatTemplate}

${buildPromptBudgetRule(input.aiTool, hasCharacter)}

${buildCinematographyRule(input.aiTool)}

${buildSingleTakeRule()}

[SCENE 1 SAAT INI -- konteks, JANGAN disalin]
Teknik hook saat ini: ${input.currentArchetype}
Narasi: "${input.currentScene.script_narration}"
${input.avoidRepetitionBlock ?? ""}
[TEKNIK HOOK YANG BOLEH DIPAKAI -- PERSIS ${variantCount} VARIAN, MASING-MASING TEKNIK BERBEDA, JANGAN pakai teknik saat ini]
${archetypeList}

ATURAN WAJIB:
- ${variantCount} varian, masing-masing teknik hook BERBEDA dari daftar di atas (jangan ulangi teknik antar varian).
- scene_number=1, duration_seconds=${input.sceneDuration} TIDAK BOLEH berubah di semua varian.
- Hook front-loaded: kalimat pertama script_narration = inti hook langsung, bukan basa-basi. WAJIB detail spesifik, bukan generik.
- Target kecepatan bicara ${input.narrationWpm} kata per menit, jadi narasi tiap varian sekitar ${Math.round((input.narrationWpm / 60) * input.sceneDuration)} kata untuk durasi ${input.sceneDuration}s. Kalimat maksimal sekitar ${toneSpec.maxWordsPerSentence} kata.
- "script_narration" Bahasa Indonesia. "visual_description", "camera_direction", "ai_ready_prompt" Bahasa Inggris. Pengecualian: kutipan dialog di dalam "ai_ready_prompt" (kalau mode lipsync) tetap Bahasa Indonesia apa adanya.
- ${productAnchorRule}
- ${priceRule}
- ${cameraPatternRule}
- ${dialogueRule}
- ${buildBannedClaimsRule()}
- ${buildRealismRule()}
- ${buildDurationMarkerRule(input.aspectRatio)}
- ${buildWordCountSelfCheckRule()}
- ${buildSpokenNumberRule(input.seed)}
- Isi "text_overlay" tiap varian: teks caption pendek (MAKSIMAL 8 kata, bahasa Indonesia) untuk di-burn-in saat editing -- inti hook varian itu, BUKAN salinan "script_narration".
- Isi "hook_archetype_used" tiap varian dengan PERSIS salah satu id dari daftar teknik di atas (mis. "curiosity_gap") sesuai teknik yang benar-benar dipakai varian itu -- WAJIB berbeda antar varian.

${negativeBlock}

OUTPUT -- HANYA objek JSON: { "variants": [ <scene1>, <scene2>, ... ${variantCount} scene objects ] }. Tiap scene object berisi: "scene_number", "duration_seconds", "speech_pace", "script_narration", "script_word_count", "visual_description", "camera_direction", "text_overlay", "transition_to_next", "ai_ready_prompt", "hook_archetype_used"${negativePromptField}. Mulai {, akhiri }. Tidak ada teks lain.
`.trim();
}
