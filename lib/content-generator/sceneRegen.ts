import { getContentStyle } from "./contentStyles";
import { buildHookInstruction } from "./hookPatterns";
import { getAiToolSpec } from "./aiTools";
import { getPlatformSpec, buildPlatformBehavior } from "./platforms";
import { buildCtaInstruction, resolveCtaForGoal, resolveCtaForPlatform } from "./ctaTypes";
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
  buildAiReadyPromptStructureRule,
  buildRealismRule,
  buildBannedClaimsRule,
  buildWordCountSelfCheckRule,
} from "./promptFragments";
import type {
  AiToolId,
  AspectRatio,
  CameraPattern,
  ContentGoal,
  ContentStyleId,
  CtaTypeId,
  HookArchetype,
  LanguageTone,
  NarrationMode,
  PlatformTarget,
  SceneOutput,
} from "./types";

export interface SceneRegenInput {
  productName: string;
  category: string;
  price: string;
  sceneIndex: number;
  totalScenes: number;
  sceneDuration: number;
  productImageUrl: string;
  previousScene: SceneOutput | null;
  nextScene: SceneOutput | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  languageTone: LanguageTone;
  characterName: string | null;
  characterDescription: string | null;
  narrationWpm: number;
  includePrice: boolean;
  // These are the EFFECTIVE per-scene values (the scene's own override, or the
  // request-level default) resolved by the caller -- previously the regen path
  // only ever saw the global default, silently reverting a deliberate per-scene
  // override and making the regenerated scene contradict its neighbours.
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
  seed: number;
}

// Regenerates a SINGLE scene without touching the others -- saves quota when
// only one scene needs fixing. Ported concept from ViralFrame Studio's
// sceneRegen.ts (locked scene_number/duration, previous/next scene as context).
export function compileSceneRegenPrompt(input: SceneRegenInput): string {
  const style = getContentStyle(input.style);
  const toolSpec = getAiToolSpec(input.aiTool);
  const platformSpec = getPlatformSpec(input.platform);
  const sceneNumber = input.sceneIndex + 1;
  const isFirstScene = input.sceneIndex === 0;
  const isLastScene = sceneNumber === input.totalScenes;
  const hasCharacter = input.characterName !== null;
  const effectiveCta = resolveCtaForPlatform(resolveCtaForGoal(input.ctaType, input.contentGoal), input.platform);
  const toneSpec = getLanguageTone(input.languageTone);

  const characterBlock = buildCharacterBlock(input.characterName, input.characterDescription);
  const dialogueRule = buildDialogueRule(input.aiTool, input.narrationMode, hasCharacter, input.seed);
  const productAnchorRule = buildProductAnchorRule(input.productName, input.category);
  const priceLine = buildProductPriceLine(input.price, input.includePrice);
  // Only the last scene carries the price mandate here: forcing a price into a
  // middle scene while the sibling scenes shown as context may already state it
  // produces a duplicated price across the video.
  const priceRule = buildPriceRule(input.includePrice && isLastScene, input.totalScenes, input.contentGoal);
  const cameraPatternRule = buildCameraPatternRule(input.cameraPattern);

  const hookBlock = isFirstScene
    ? `\n[HOOK -- SCENE INI ADALAH SCENE 1]\n${buildHookInstruction(input.hookArchetype, input.platform, input.sceneDuration, input.seed)}\n`
    : "";

  const contextBlock = `
${input.previousScene ? `[SCENE SEBELUMNYA -- konteks, JANGAN diubah]\n${JSON.stringify(input.previousScene)}\nScene baru WAJIB nyambung natural dari transition_to_next scene ini.` : "[Scene ini adalah scene PERTAMA -- tidak ada scene sebelumnya.]"}
${input.nextScene ? `\n[SCENE SESUDAHNYA -- konteks, JANGAN diubah]\n${JSON.stringify(input.nextScene)}\ntransition_to_next pada scene baru WAJIB mengarah masuk akal ke scene ini.` : "\n[Scene ini adalah scene TERAKHIR -- tidak ada scene sesudahnya.]"}`.trim();

  const negativeBlock = buildNegativePromptBlock({
    // The surrounding scenes still exist, so cross-scene consistency applies
    // here even though only one scene is being written.
    sceneCount: input.totalScenes,
    allowsVisualChange: style.allowsVisualChange,
    supportsNegativePromptField: toolSpec.supportsNegativePrompt,
  });

  const negativePromptField = toolSpec.supportsNegativePrompt ? `,\n  "negative_prompt": string` : "";

  return `
Kamu meregenerate SATU scene (scene ${sceneNumber} dari ${input.totalScenes}) dari sebuah video affiliate produk, TANPA mengubah scene lain.

PRODUK: ${input.productName} (${input.category})${priceLine ? `, ${priceLine.replace(/^- /, '')}` : ''}
${characterBlock}

GAYA VIDEO: ${style.label}
Struktur keseluruhan video: ${style.structureDescription}
- Instruksi kamera: ${style.cameraInstruction}
- Instruksi nada bicara: ${style.narrativeVoiceGuidance}

${buildLanguageToneRule(input.languageTone, input.seed)}

${buildDeliveryTechniqueRule()}

PLATFORM: ${platformSpec.label} (rasio ${input.aspectRatio}) -- ${buildPlatformBehavior(input.platform, input.includePrice)}
AI VIDEO TOOL: ${toolSpec.label} (satu scene maksimal ~${toolSpec.maxDurationSeconds}s). Format: ${toolSpec.formatTemplate}

${buildPromptBudgetRule(input.aiTool, hasCharacter)}

${buildAiReadyPromptStructureRule(hasCharacter, input.aspectRatio, toneSpec.genreAnchor)}

${buildCinematographyRule(input.aiTool)}

${buildSingleTakeRule()}
${hookBlock}
${isLastScene ? `CTA scene ini: ${buildCtaInstruction(effectiveCta, input.seed)}` : ""}

${contextBlock}

ATURAN:
- scene_number HARUS PERSIS ${sceneNumber}, duration_seconds HARUS PERSIS ${input.sceneDuration}.
- "script_narration" Bahasa Indonesia. "visual_description", "camera_direction", "ai_ready_prompt" Bahasa Inggris. Pengecualian: kutipan dialog di dalam "ai_ready_prompt" (kalau mode scene ini lipsync) tetap Bahasa Indonesia apa adanya -- menerjemahkannya membuat karakter bicara bahasa yang salah.
- Target kecepatan bicara ${input.narrationWpm} kata per menit. Kalimat maksimal sekitar ${toneSpec.maxWordsPerSentence} kata (sesuai gaya bahasa di atas), HINDARI kalimat majemuk yang jauh melebihi itu -- pecah jadi beberapa kalimat supaya AI voice tidak salah penekanan/terdengar blibet.
- ${productAnchorRule}
- ${priceRule}
- ${cameraPatternRule}
- ${dialogueRule}
- ${buildBannedClaimsRule()}
- ${buildRealismRule()}
- ${buildWordCountSelfCheckRule()}
- ${buildSpokenNumberRule(input.seed)}
- Isi "text_overlay": teks caption pendek (MAKSIMAL 8 kata, bahasa Indonesia) untuk di-burn-in saat editing -- BUKAN salinan "script_narration", inti pesan scene ini saja.

${negativeBlock}

OUTPUT -- HANYA SATU OBJEK JSON scene tunggal (bukan array, bukan dibungkus objek lain), struktur persis:
{
  "scene_number": ${sceneNumber},
  "duration_seconds": ${input.sceneDuration},
  "speech_pace": string,
  "script_narration": string,
  "script_word_count": number,
  "visual_description": string,
  "camera_direction": string,
  "text_overlay": string,
  "transition_to_next": string,
  "ai_ready_prompt": string${negativePromptField}
}
Mulai {, akhiri }. Tidak ada teks lain.
`.trim();
}
