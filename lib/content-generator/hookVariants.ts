import { getContentStyle } from "./contentStyles";
import { HOOK_ARCHETYPES } from "./hookPatterns";
import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import { getPlatformSpec } from "./platforms";
import { NEGATIVE_PROMPT_BLOCK, SPOKEN_NUMBER_RULE } from "./negativePrompt";
import type { AiToolId, AspectRatio, ContentStyleId, HookArchetype, PlatformTarget, SceneOutput } from "./types";

export interface HookVariantsInput {
  productName: string;
  category: string;
  price: string;
  sceneDuration: number;
  productImageUrl: string;
  currentScene: SceneOutput;
  currentArchetype: HookArchetype;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  characterName: string | null;
  characterDescription: string | null;
  variantCount?: number;
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

  const availableArchetypes = Object.values(HOOK_ARCHETYPES).filter((a) => a.id !== input.currentArchetype);
  const archetypeList = availableArchetypes.map((a) => `- ${a.id}: ${a.instruction}`).join("\n");

  const characterBlock = input.characterName
    ? `KARAKTER (WAJIB KONSISTEN): "${input.characterName}". ${input.characterDescription ?? ""} Setiap varian WAJIB menyebut nama karakter ini.`
    : "Tidak ada karakter/talent (faceless).";

  const dialogueRule = usesLiteralDialogueConvention(input.aiTool)
    ? `Dialog WAJIB kutipan literal: [Subjek] says, "<script_narration verbatim>" (no subtitles).`
    : `Sisipkan tag [DIALOGUE: Bahasa Indonesia] setelah deskripsi visual.`;

  return `
Kamu membuat ${variantCount} VARIASI HOOK untuk scene 1 dari sebuah video affiliate produk, masing-masing memakai teknik hook BERBEDA.

PRODUK: ${input.productName} (${input.category}, Rp ${input.price})
${characterBlock}

GAYA VIDEO: ${style.label}
PLATFORM: ${platformSpec.label} -- ${platformSpec.behavior}
AI VIDEO TOOL: ${toolSpec.label} (batas ai_ready_prompt: ${toolSpec.charLimit} karakter). Format: ${toolSpec.formatTemplate}

[SCENE 1 SAAT INI -- konteks, JANGAN disalin]
Teknik hook saat ini: ${input.currentArchetype}
Narasi: "${input.currentScene.script_narration}"

[TEKNIK HOOK YANG BOLEH DIPAKAI -- PERSIS ${variantCount} VARIAN, MASING-MASING TEKNIK BERBEDA, JANGAN pakai teknik saat ini]
${archetypeList}

ATURAN WAJIB:
- ${variantCount} varian, masing-masing teknik hook BERBEDA dari daftar di atas (jangan ulangi teknik antar varian).
- scene_number=1, duration_seconds=${input.sceneDuration} TIDAK BOLEH berubah di semua varian.
- Hook front-loaded: kalimat pertama script_narration = inti hook langsung, bukan basa-basi. WAJIB angka/detail spesifik, bukan generik.
- "script_narration" Bahasa Indonesia. "visual_description", "camera_direction", "ai_ready_prompt" Bahasa Inggris.
- ${dialogueRule}
- ${SPOKEN_NUMBER_RULE}

${NEGATIVE_PROMPT_BLOCK}

OUTPUT -- HANYA objek JSON: { "variants": [ <scene1>, <scene2>, ... ${variantCount} scene objects, struktur sama seperti SceneOutput ] }. Mulai {, akhiri }. Tidak ada teks lain.
`.trim();
}
