import { getContentStyle } from "./contentStyles";
import { buildHookInstruction } from "./hookPatterns";
import { getAiToolSpec } from "./aiTools";
import { getPlatformSpec } from "./platforms";
import { getCtaType, resolveCtaForGoal } from "./ctaTypes";
import { NEGATIVE_PROMPT_BLOCK, SPOKEN_NUMBER_RULE } from "./negativePrompt";
import {
  buildCharacterBlock,
  buildDialogueRule,
  buildProductAnchorRule,
  buildProductPriceLine,
  buildPriceRule,
  buildCameraPatternRule,
} from "./promptFragments";
import type {
  AiToolId,
  AspectRatio,
  CameraPattern,
  ContentGoal,
  ContentStyleId,
  CtaTypeId,
  HookArchetype,
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
  characterName: string | null;
  characterDescription: string | null;
  narrationWpm: number;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
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
  const effectiveCta = resolveCtaForGoal(input.ctaType, input.contentGoal);
  const ctaSpec = getCtaType(effectiveCta);

  const characterBlock = buildCharacterBlock(input.characterName, input.characterDescription);
  const dialogueRule = buildDialogueRule(input.aiTool, input.narrationMode);
  const productAnchorRule = buildProductAnchorRule(input.productName, input.category);
  const priceLine = buildProductPriceLine(input.price, input.includePrice);
  const priceRule = buildPriceRule(input.includePrice);
  const cameraPatternRule = buildCameraPatternRule(input.cameraPattern);

  const hookBlock = isFirstScene
    ? `\n[HOOK -- SCENE INI ADALAH SCENE 1]\n${buildHookInstruction(input.hookArchetype, input.platform, input.sceneDuration)}\n`
    : "";

  const contextBlock = `
${input.previousScene ? `[SCENE SEBELUMNYA -- konteks, JANGAN diubah]\n${JSON.stringify(input.previousScene)}\nScene baru WAJIB nyambung natural dari transition_to_next scene ini.` : "[Scene ini adalah scene PERTAMA -- tidak ada scene sebelumnya.]"}
${input.nextScene ? `\n[SCENE SESUDAHNYA -- konteks, JANGAN diubah]\n${JSON.stringify(input.nextScene)}\ntransition_to_next pada scene baru WAJIB mengarah masuk akal ke scene ini.` : "\n[Scene ini adalah scene TERAKHIR -- tidak ada scene sesudahnya.]"}`.trim();

  return `
Kamu meregenerate SATU scene (scene ${sceneNumber} dari ${input.totalScenes}) dari sebuah video affiliate produk, TANPA mengubah scene lain.

PRODUK: ${input.productName} (${input.category})${priceLine ? `, ${priceLine.replace(/^- /, '')}` : ''}
${characterBlock}

GAYA VIDEO: ${style.label} -- ${style.narrativeVoiceGuidance}
PLATFORM: ${platformSpec.label} (rasio ${input.aspectRatio}) -- ${platformSpec.behavior}
AI VIDEO TOOL: ${toolSpec.label} (batas ai_ready_prompt: ${toolSpec.charLimit} karakter). Format: ${toolSpec.formatTemplate}
${hookBlock}
${sceneNumber === input.totalScenes ? `CTA scene ini: ${ctaSpec.instruction}` : ""}

${contextBlock}

ATURAN:
- scene_number HARUS PERSIS ${sceneNumber}, duration_seconds HARUS PERSIS ${input.sceneDuration}.
- "script_narration" Bahasa Indonesia. "visual_description", "camera_direction", "ai_ready_prompt" Bahasa Inggris.
- Target kecepatan bicara ${input.narrationWpm} kata per menit. WAJIB pakai kalimat PENDEK (di bawah 12 kata), HINDARI kalimat majemuk panjang -- pecah jadi beberapa kalimat pendek supaya AI voice tidak salah penekanan/terdengar blibet.
- ${productAnchorRule}
- ${priceRule}
- ${cameraPatternRule}
- ${dialogueRule}
- ${SPOKEN_NUMBER_RULE}
- Isi "text_overlay": teks caption pendek (MAKSIMAL 8 kata, bahasa Indonesia) untuk di-burn-in saat editing -- BUKAN salinan "script_narration", inti pesan scene ini saja.

${NEGATIVE_PROMPT_BLOCK}

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
  "reference_images": { "character": null, "product": "" },
  "ai_ready_prompt": string
}
Mulai {, akhiri }. Tidak ada teks lain.
`.trim();
}
