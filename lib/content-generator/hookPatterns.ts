import { getPlatformSpec } from "./platforms";
import type { HookArchetype, PlatformTarget } from "./types";

interface HookArchetypeSpec {
  id: HookArchetype;
  label: string;
  instruction: string;
}

// Archetypes + retention data from 2026 research (numeric-specificity requirement,
// Unpopular Opinion / POV Realism / Specific Outcome get 35-45% higher 3s
// retention than generic product reveals).
export const HOOK_ARCHETYPES: Record<HookArchetype, HookArchetypeSpec> = {
  unpopular_opinion: {
    id: "unpopular_opinion",
    label: "Unpopular Opinion",
    instruction: 'Buka dengan pendapat yang berlawanan dari anggapan umum tentang kategori produk ini (mis. "Stop beli [kategori] mahal, ini alasannya").',
  },
  pov_realism: {
    id: "pov_realism",
    label: "POV Realism",
    instruction: "Buka dari sudut pandang orang pertama yang sangat spesifik dan relatable, seolah penonton mengalami momen itu sendiri.",
  },
  specific_outcome: {
    id: "specific_outcome",
    label: "Specific Outcome",
    instruction: 'Buka dengan angka/hasil konkret dan spesifik (mis. "dari 2x jadi 6x", bukan "meningkat drastis") -- angka spesifik terbukti ~2.4x lebih menahan perhatian daripada klaim generik.',
  },
  curiosity_gap: {
    id: "curiosity_gap",
    label: "Curiosity Gap",
    instruction: "Buka dengan info yang sengaja belum lengkap, memancing rasa penasaran untuk menonton sampai payoff-nya.",
  },
  relatable: {
    id: "relatable",
    label: "Relatable",
    instruction: "Buka dengan situasi/kebiasaan sehari-hari yang langsung terasa related oleh target audiens.",
  },
  emotional: {
    id: "emotional",
    label: "Emotional",
    instruction: "Buka dengan momen yang menyentuh emosi spesifik (lega, kaget, frustrasi) yang relevan dengan masalah yang diselesaikan produk.",
  },
  mistake_warning: {
    id: "mistake_warning",
    label: "Mistake Warning",
    instruction: 'Buka dengan peringatan kesalahan umum yang sering dilakukan orang seputar kategori produk ini (mis. "Jangan beli [kategori] sebelum tahu ini" atau "Kesalahan ini yang bikin [masalah] tidak selesai-selesai") -- salah satu dari 3 formula hook terkuat di riset 2026.',
  },
};

export function getHookArchetype(id: HookArchetype): HookArchetypeSpec {
  return HOOK_ARCHETYPES[id];
}

export function buildHookInstruction(archetype: HookArchetype, platform: PlatformTarget, hookWindowSeconds: number): string {
  const spec = getHookArchetype(archetype);
  const platformSpec = getPlatformSpec(platform);
  return `3-5 detik pertama scene 1 (dari total durasi ${hookWindowSeconds}s scene ini) WAJIB memakai pola hook "${spec.label}": ${spec.instruction} Sisa durasi scene 1 bebas mengikuti gaya video. WAJIB gunakan angka/detail spesifik, BUKAN generik. Sesuaikan juga dengan perilaku platform tujuan: ${platformSpec.behavior}`;
}
