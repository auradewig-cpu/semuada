import type { ContentStyleId } from "./types";

interface ContentStyleDefinition {
  id: ContentStyleId;
  label: string;
  structureDescription: string;
  cameraInstruction: string;
  narrativeVoiceGuidance: string;
  ctaIntensity: "hard" | "soft" | "none";
  // Default narration pace in words-per-minute for this style, used when the
  // admin hasn't manually overridden the global AI Settings WPM (2026 research:
  // hard-sell ~170-190, soft-sell ~145, documentary/vlog pacing ~110-130).
  defaultWpm: number;
}

// Ported from ViralFrame Studio's contentStyles.ts (field-tested), adapted for
// general product-affiliate framing -- property_tour dropped (real-estate-only).
export const CONTENT_STYLES: Record<ContentStyleId, ContentStyleDefinition> = {
  direct_response: {
    id: "direct_response",
    label: "Direct Response / Iklan",
    structureDescription:
      "Scene 1 = Hook (pancing perhatian) -> Scene tengah = Body (bangun minat & USP) -> Scene terakhir = CTA (ajakan bertindak keras)",
    cameraInstruction: "Kamera stabil, framing medium shot talent + produk, sesekali cutaway ke detail produk.",
    narrativeVoiceGuidance: "Gaya persuasif direct-response, USP ditegaskan minimal 2x, nada percaya diri menjual.",
    ctaIntensity: "hard",
    defaultWpm: 170,
  },
  vlog_daily: {
    id: "vlog_daily",
    label: "Vlog / Day-in-Life",
    structureDescription:
      "Scene 1 = Opening (perkenalan momen) -> Scene tengah = Momen berurutan (aktivitas natural) -> Scene terakhir = Refleksi/Penutup santai (BUKAN CTA keras)",
    cameraInstruction: "Kamera handheld, sedikit goyang natural, talent bicara sambil beraktivitas.",
    narrativeVoiceGuidance:
      'Gaya cerita personal seperti diary/vlog -- "aku hari ini...", "jadi tadi...". Natural, tidak scripted, tanpa nada menjual.',
    ctaIntensity: "none",
    defaultWpm: 120,
  },
  tutorial_howto: {
    id: "tutorial_howto",
    label: "Tutorial / How-To",
    structureDescription:
      "Scene 1 = Hook Masalah (sebut masalah/keyword) -> Scene tengah = Langkah 1..N (instruksional bernomor) -> Scene terakhir = Hasil/Recap + ajakan follow",
    cameraInstruction: "Kamera stabil, angle jelas memperlihatkan langkah demi langkah.",
    narrativeVoiceGuidance:
      'Gaya instruksional jelas, sebutkan keyword/topik di awal. Tiap langkah dijelaskan singkat dan actionable -- "Langkah pertama, ...". Nada membantu, bukan menjual.',
    ctaIntensity: "soft",
    defaultWpm: 135,
  },
  storytime: {
    id: "storytime",
    label: "Storytime",
    structureDescription:
      "Scene 1 = Setup (situasi spesifik) -> Scene tengah = Ketegangan naik -> Scene terakhir = Klimaks/Payoff (twist atau resolusi memuaskan)",
    cameraInstruction: "Kamera mengikuti mood scene, lebih dekat/intim di momen ketegangan.",
    narrativeVoiceGuidance:
      "WAJIB gunakan detail SANGAT SPESIFIK (bukan generic) -- nama, waktu, tempat, angka konkret. Nada storytelling natural, seperti cerita ke teman.",
    ctaIntensity: "none",
    defaultWpm: 130,
  },
  listicle_countdown: {
    id: "listicle_countdown",
    label: "Listicle / Countdown",
    structureDescription:
      "Scene 1 = Intro (sebutkan total jumlah poin & topik) -> Scene tengah = Poin 1..N (1 scene = 1 poin) -> Scene terakhir = Penutup/rangkuman",
    cameraInstruction: "Kamera stabil, cutaway ke detail tiap poin.",
    narrativeVoiceGuidance:
      'Sebutkan NOMOR poin secara eksplisit di setiap scene ("Nomor 1...", "yang kedua..."). Tiap poin harus punya value/insight jelas, bukan filler.',
    ctaIntensity: "soft",
    defaultWpm: 150,
  },
  before_after: {
    id: "before_after",
    label: "Before/After / Transformasi",
    structureDescription:
      "Scene 1 = Kondisi Awal (masalah/keadaan sebelum) -> Scene tengah = Proses (langkah transformasi) -> Scene terakhir = Reveal Hasil (kondisi sesudah, dramatis)",
    cameraInstruction: "Framing konsisten antara before/after supaya kontras terlihat jelas.",
    narrativeVoiceGuidance:
      "Fokus pada KONTRAS visual antara sebelum dan sesudah. Nada membangun antisipasi menuju reveal. HINDARI klaim before/after yang melanggar aturan kepatuhan (terutama fisik/kesehatan) -- gunakan observasi netral.",
    ctaIntensity: "soft",
    defaultWpm: 140,
  },
  pattern_break_twist: {
    id: "pattern_break_twist",
    label: "Pattern-Break / Twist Reveal",
    structureDescription:
      "Scene 1 = Setup (tampak seperti format/genre lain) -> Scene tengah = Twist Point (reveal tak terduga) -> Scene terakhir = Resolusi (jelaskan twist, tutup dengan kuat)",
    cameraInstruction: "Gaya visual berubah drastis antara sebelum dan sesudah twist.",
    narrativeVoiceGuidance:
      "Scene pembuka WAJIB terasa seperti genre/format lain -- kejutannya di STRUKTUR cerita, bukan cuma visual. Nada berubah drastis dari sebelum ke sesudah twist.",
    ctaIntensity: "soft",
    defaultWpm: 145,
  },
  series_episodic: {
    id: "series_episodic",
    label: "Series / Episodic",
    structureDescription:
      "Scene 1 = Recap singkat/Hook -> Scene tengah = Konten inti -> Scene terakhir = Open Loop (menggantung sengaja, tease part berikutnya)",
    cameraInstruction: "Kamera konsisten dengan identitas visual seri.",
    narrativeVoiceGuidance:
      'Scene terakhir WAJIB diakhiri dengan open loop yang genuinely earned -- beri alasan kuat untuk follow/nunggu part berikutnya. Sebutkan eksplisit "part 1 dari beberapa" kalau relevan.',
    ctaIntensity: "soft",
    defaultWpm: 135,
  },
};

export function getContentStyle(id: ContentStyleId): ContentStyleDefinition {
  return CONTENT_STYLES[id];
}

// AI Settings' narrationWpm column defaults to 180 (see shared/schema.ts) and
// has no separate "not customized" flag. Treat 180 as the un-touched default:
// if the admin left it at 180, use the style's researched default pace instead;
// any other value is an explicit manual override and wins outright.
const UNCUSTOMIZED_WPM_DEFAULT = 180;

export function resolveNarrationWpm(styleId: ContentStyleId, settingsWpm: number | null): number {
  if (settingsWpm !== null && settingsWpm !== UNCUSTOMIZED_WPM_DEFAULT) return settingsWpm;
  return getContentStyle(styleId).defaultWpm;
}
