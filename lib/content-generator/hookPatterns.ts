import { pickExamples, formatExamples, deriveSeed, HOOK_OPENER_BANK } from "./exampleBank";
import type { HookArchetype, PlatformTarget } from "./types";

interface HookArchetypeSpec {
  id: HookArchetype;
  label: string;
  // Technique only -- concrete opener phrasings live in exampleBank.ts and are
  // rotated per request. The previous inline examples carried square-bracket
  // placeholders ("Stop beli [kategori] mahal") that shipped to users with the
  // brackets intact whenever the model copied them literally.
  instruction: string;
}

// Archetypes + retention data from 2026 research (numeric-specificity requirement,
// Unpopular Opinion / POV Realism / Specific Outcome get 35-45% higher 3s
// retention than generic product reveals).
export const HOOK_ARCHETYPES: Record<HookArchetype, HookArchetypeSpec> = {
  unpopular_opinion: {
    id: "unpopular_opinion",
    label: "Unpopular Opinion",
    instruction:
      "Buka dengan pendapat yang berlawanan dari anggapan umum tentang kategori produk ini -- posisikan diri melawan saran yang biasa beredar, lalu beri alasannya.",
  },
  pov_realism: {
    id: "pov_realism",
    label: "POV Realism",
    instruction:
      "Buka dari sudut pandang orang pertama yang sangat spesifik dan relatable, seolah penonton mengalami momen itu sendiri. Sebut situasi, waktu, atau tempat yang konkret.",
  },
  specific_outcome: {
    id: "specific_outcome",
    label: "Specific Outcome",
    instruction:
      "Buka dengan hasil konkret yang bisa diukur atau dibandingkan, bukan klaim generik seperti 'meningkat drastis'. Angka yang dipakai HARUS masuk akal untuk produk ini dan JANGAN mengarang statistik.",
  },
  curiosity_gap: {
    id: "curiosity_gap",
    label: "Curiosity Gap",
    instruction:
      "Buka dengan info yang sengaja belum lengkap, memancing rasa penasaran untuk menonton sampai payoff-nya di akhir.",
  },
  relatable: {
    id: "relatable",
    label: "Relatable",
    instruction:
      "Buka dengan situasi/kebiasaan sehari-hari yang langsung terasa related oleh target audiens produk ini.",
  },
  emotional: {
    id: "emotional",
    label: "Emotional",
    instruction:
      "Buka dengan momen yang menyentuh emosi spesifik (lega, kaget, frustrasi) yang relevan dengan masalah yang diselesaikan produk.",
  },
  mistake_warning: {
    id: "mistake_warning",
    label: "Mistake Warning",
    instruction:
      "Buka dengan peringatan kesalahan umum yang sering dilakukan orang seputar kategori produk ini -- salah satu dari 3 formula hook terkuat di riset 2026.",
  },
};

export function getHookArchetype(id: HookArchetype): HookArchetypeSpec {
  return HOOK_ARCHETYPES[id];
}

// The hook window used to be hardcoded "3-5 detik" even when the scene itself
// is only 2s (the schema minimum), which asks for a hook longer than the shot.
// Derive it from the actual duration instead.
function hookWindowLabel(sceneDuration: number): string {
  if (sceneDuration <= 3) return `SELURUH ${sceneDuration} detik scene ini`;
  const upper = Math.min(5, Math.max(2, Math.round(sceneDuration * 0.5)));
  return `${Math.max(2, upper - 1)}-${upper} detik pertama scene 1 (dari total ${sceneDuration}s scene ini)`;
}

// platformBehavior is passed in rather than looked up here: masterPrompt.ts
// already emits the platform block a few lines above, and re-deriving it here
// duplicated the identical paragraph twice inside one prompt.
export function buildHookInstruction(
  archetype: HookArchetype,
  _platform: PlatformTarget,
  hookWindowSeconds: number,
  seed: number
): string {
  const spec = getHookArchetype(archetype);
  const picked = pickExamples(HOOK_OPENER_BANK[archetype], 2, deriveSeed(seed, 2));
  return `${hookWindowLabel(hookWindowSeconds)} WAJIB memakai pola hook "${spec.label}": ${spec.instruction} Sisa durasi scene 1 bebas mengikuti gaya video. WAJIB gunakan detail spesifik, BUKAN generik.
Arah pembukaan yang cocok untuk pola ini (inspirasi rasa saja, JANGAN disalin apa adanya): ${formatExamples(picked)}.`;
}
