import type { AiToolId } from "./types";

interface AiToolSpec {
  id: AiToolId;
  label: string;
  charLimit: number;
  supportsRef: boolean;
  formatTemplate: string;
}

// Ported from ViralFrame Studio's maps.ts (AI_TOOLS + AI_TOOL_FORMAT), field-tested
// prompt conventions per AI video tool -- trimmed to the tools relevant here.
export const AI_TOOLS: Record<AiToolId, AiToolSpec> = {
  google_flow: {
    id: "google_flow",
    label: "Google Flow",
    charLimit: 500,
    supportsRef: true,
    formatTemplate:
      "Natural descriptive prompt in English: [Scene setting]. [Character appearance + action]. [Camera angle + movement]. [Lighting]. [Mood]. Policy-safe: bahasa netral, hindari klaim absolut/medis/testimonial. Hanya deskripsi visual -- tanpa ajakan, tanpa klaim produk.",
  },
  veo3: {
    id: "veo3",
    label: "Google Veo 3",
    charLimit: 500,
    supportsRef: true,
    formatTemplate:
      "Mulai dengan CHARACTER ANCHOR (salin persis dari deskripsi karakter, jika ada). Format: '[Character anchor] -- [scene action]. [Camera movement]. [Environment, lighting]. [Mood]. [Xs, RATIO frame]' English only. Dialog WAJIB disisipkan sebagai kutipan literal: [Subjek] says, \"<script_narration verbatim>\" (no subtitles) -- konvensi resmi Veo3, model menyimpulkan bahasa ucapan dari isi kalimat dalam kutip, bukan label bahasa.",
  },
  kling_ai: {
    id: "kling_ai",
    label: "Kling AI 2.0",
    charLimit: 400,
    supportsRef: true,
    formatTemplate:
      'Subject description. Action/motion. Camera movement. Environment. Lighting. Style/mood. English. Tutup dengan [DIALOGUE: Bahasa Indonesia] "<narasi asli>" -- kutipan narasi WAJIB disertakan, bukan tag kosong.',
  },
  runway_gen4: {
    id: "runway_gen4",
    label: "Runway Gen-4",
    charLimit: 300,
    supportsRef: true,
    formatTemplate:
      'Action-first. Camera keyword. Environment. Style. [X]s. English. Tutup dengan [DIALOGUE: Bahasa Indonesia] "<narasi asli>" -- kutipan narasi WAJIB disertakan, bukan tag kosong.',
  },
  luma_dream: {
    id: "luma_dream",
    label: "Luma Dream Machine",
    charLimit: 300,
    supportsRef: true,
    formatTemplate:
      'One cinematic sentence + style tags. English. Tutup dengan [DIALOGUE: Bahasa Indonesia] "<narasi asli>" -- kutipan narasi WAJIB disertakan, bukan tag kosong.',
  },
  pika_labs: {
    id: "pika_labs",
    label: "Pika Labs 2.0",
    charLimit: 250,
    supportsRef: true,
    formatTemplate:
      'Short: \'[Subject] [action] [environment]. [Camera]. [Mood]. [X]s.\' English. Tutup dengan [DIALOGUE: Bahasa Indonesia] "<narasi asli>" -- kutipan narasi WAJIB disertakan, bukan tag kosong.',
  },
  sora: {
    id: "sora",
    label: "OpenAI Sora",
    charLimit: 600,
    supportsRef: false,
    formatTemplate:
      'Rich detailed description: character + action + environment + camera + lighting + mood. Longer is better. English. Tutup dengan [DIALOGUE: Bahasa Indonesia] "<narasi asli>" -- kutipan narasi WAJIB disertakan, bukan tag kosong.',
  },
};

export function getAiToolSpec(id: AiToolId): AiToolSpec {
  return AI_TOOLS[id];
}

export function usesLiteralDialogueConvention(id: AiToolId): boolean {
  return id === "veo3" || id === "google_flow";
}
