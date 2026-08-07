import type { AiToolId } from "./types";

interface AiToolSpec {
  id: AiToolId;
  label: string;
  // A readability/quality TARGET, not a hard API ceiling -- confirmed with the
  // user that generated prompts are copy-pasted manually into each tool's web
  // UI, which has no real character cap. The old values (250-600, "ported from
  // ViralFrame Studio") assumed an API call and were starving the prompt of
  // detail; real-world example prompts that get good results from these same
  // tools run 900-1300+ characters using labeled multi-line sections (see
  // buildAiReadyPromptStructureRule in promptFragments.ts). Kept relatively
  // ordered per tool (Pika stays the terser convention, Sora the most verbose)
  // rather than made uniform, since that convention still shapes output style.
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
  // Short, tool-specific note only. The detailed STRUCTURE instruction (labeled
  // Scene:/Camera:/Lighting:/Style:/Duration:/Important: sections) is now one
  // shared fragment (buildAiReadyPromptStructureRule) used identically by all
  // three prompt builders -- per-tool templates used to restate a near-
  // identical dialogue clause 6 times and drift between builders.
  formatTemplate: string;
}

// Ported from ViralFrame Studio's maps.ts (AI_TOOLS + AI_TOOL_FORMAT), field-tested
// prompt conventions per AI video tool -- trimmed to the tools relevant here.
export const AI_TOOLS: Record<AiToolId, AiToolSpec> = {
  google_flow: {
    id: "google_flow",
    label: "Google Flow",
    charLimit: 1300,
    supportsRef: true,
    maxDurationSeconds: 8,
    supportsNegativePrompt: false,
    formatTemplate: "Bahasa visualnya netral dan policy-safe -- hindari klaim absolut/medis/testimonial di dalam deskripsi visual.",
  },
  veo3: {
    id: "veo3",
    label: "Google Veo 3",
    charLimit: 1300,
    supportsRef: true,
    maxDurationSeconds: 8,
    supportsNegativePrompt: false,
    formatTemplate: "Mendukung audio native (narasi + ambience) sekaligus dalam satu generate.",
  },
  kling_ai: {
    id: "kling_ai",
    label: "Kling AI 2.0",
    charLimit: 1100,
    supportsRef: true,
    maxDurationSeconds: 10,
    supportsNegativePrompt: true,
    formatTemplate: "Punya field negative prompt terpisah -- lihat instruksi negative prompt.",
  },
  runway_gen4: {
    id: "runway_gen4",
    label: "Runway Gen-4",
    charLimit: 900,
    supportsRef: true,
    maxDurationSeconds: 10,
    supportsNegativePrompt: true,
    formatTemplate: "Punya field negative prompt terpisah -- lihat instruksi negative prompt.",
  },
  luma_dream: {
    id: "luma_dream",
    label: "Luma Dream Machine",
    charLimit: 900,
    supportsRef: true,
    maxDurationSeconds: 9,
    supportsNegativePrompt: false,
    formatTemplate: "Merespons baik ke deskripsi sinematik yang ringkas per baris.",
  },
  pika_labs: {
    id: "pika_labs",
    label: "Pika Labs 2.0",
    charLimit: 700,
    supportsRef: true,
    maxDurationSeconds: 5,
    supportsNegativePrompt: false,
    formatTemplate: "Konvensinya lebih ringkas dari tool lain -- tetap pakai struktur berlabel, tapi tiap baris lebih pendek.",
  },
  sora: {
    id: "sora",
    label: "OpenAI Sora",
    charLimit: 1600,
    supportsRef: false,
    maxDurationSeconds: 20,
    supportsNegativePrompt: false,
    formatTemplate: "Merespons baik ke deskripsi yang detail dan kaya -- tidak mendukung foto referensi.",
  },
};

export function getAiToolSpec(id: AiToolId): AiToolSpec {
  return AI_TOOLS[id];
}

export function usesLiteralDialogueConvention(id: AiToolId): boolean {
  return id === "veo3" || id === "google_flow";
}
