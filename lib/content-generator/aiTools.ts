import type { AiToolId } from "./types";

interface AiToolSpec {
  id: AiToolId;
  label: string;
  charLimit: number;
  supportsRef: boolean;
  // Real per-clip ceiling for a single generation. The scene-duration schema
  // allows 2-60s, so without this the system happily emits "[45s, 9:16 frame]"
  // for a tool that physically cannot produce more than 8 seconds, and paces 45
  // seconds of narration into it. Used for warnings only -- never clamps the
  // user's chosen duration.
  maxDurationSeconds: number;
  // Kling and Runway expose a DEDICATED negative-prompt input. For those,
  // negatives belong in their own field; writing them into the positive prompt
  // is the best-documented way to summon the artifacts being banned.
  supportsNegativePrompt: boolean;
  // Structure only. The dialogue/voiceover convention used to be duplicated
  // verbatim into 6 of these 7 templates and pointed at a prompt section
  // ("INSTRUKSI PER SCENE") that only exists in masterPrompt.ts -- a dangling
  // reference in the other two builders. That clause now lives solely in
  // buildDialogueRule().
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
    maxDurationSeconds: 8,
    supportsNegativePrompt: false,
    formatTemplate:
      "Natural descriptive prompt in English: [Scene setting]. [Subject appearance + action]. [Shot size + camera movement]. [Lighting]. [Mood]. Bahasa visualnya netral dan policy-safe: hindari klaim absolut/medis/testimonial di dalam deskripsi visual.",
  },
  veo3: {
    id: "veo3",
    label: "Google Veo 3",
    charLimit: 500,
    supportsRef: true,
    maxDurationSeconds: 8,
    supportsNegativePrompt: false,
    formatTemplate:
      "Mulai dengan ANCHOR subjek (salin persis dari deskripsi karakter/format faceless). Format: '[Anchor] -- [scene action]. [Shot size + camera movement]. [Environment, lighting]. [Mood]. [Xs, RATIO frame]' English only.",
  },
  kling_ai: {
    id: "kling_ai",
    label: "Kling AI 2.0",
    charLimit: 400,
    supportsRef: true,
    maxDurationSeconds: 10,
    supportsNegativePrompt: true,
    formatTemplate: "Subject description. Action/motion. Shot size + camera movement. Environment. Lighting. Style/mood. English.",
  },
  runway_gen4: {
    id: "runway_gen4",
    label: "Runway Gen-4",
    charLimit: 300,
    supportsRef: true,
    maxDurationSeconds: 10,
    supportsNegativePrompt: true,
    formatTemplate: "Action-first. Shot size + camera movement keyword. Environment. Style. English. Ringkas -- batas karakternya ketat.",
  },
  luma_dream: {
    id: "luma_dream",
    label: "Luma Dream Machine",
    charLimit: 300,
    supportsRef: true,
    maxDurationSeconds: 9,
    supportsNegativePrompt: false,
    formatTemplate: "Satu kalimat sinematik yang padat (subjek + aksi + shot size + gerakan kamera + cahaya) lalu style tags. English.",
  },
  pika_labs: {
    id: "pika_labs",
    label: "Pika Labs 2.0",
    charLimit: 250,
    supportsRef: true,
    maxDurationSeconds: 5,
    supportsNegativePrompt: false,
    formatTemplate:
      "Sangat ringkas: '[Subject] [action] [environment]. [Shot size + camera]. [Mood].' English. Batas karakternya paling ketat di antara semua tool -- buang semua kata yang tidak menambah informasi visual.",
  },
  sora: {
    id: "sora",
    label: "OpenAI Sora",
    charLimit: 600,
    supportsRef: false,
    maxDurationSeconds: 20,
    supportsNegativePrompt: false,
    formatTemplate:
      "Deskripsi kaya dan detail: subjek + aksi + lingkungan + shot size + gerakan kamera + pencahayaan + mood. Makin detail makin baik selama masih dalam batas karakter. English.",
  },
};

export function getAiToolSpec(id: AiToolId): AiToolSpec {
  return AI_TOOLS[id];
}

export function usesLiteralDialogueConvention(id: AiToolId): boolean {
  return id === "veo3" || id === "google_flow";
}
