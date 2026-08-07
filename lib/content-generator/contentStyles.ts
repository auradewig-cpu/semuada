import { getLanguageTone } from "./languageTones";
import type { ContentStyleId, LanguageTone } from "./types";

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
  // True when the style's whole premise REQUIRES the visuals to change between
  // scenes. The cross-scene consistency block (negativePrompt.ts) locks
  // setting/lighting/wardrobe/grading, which makes a "dramatic after reveal" or
  // a "visual style changes drastically at the twist" structurally impossible
  // to satisfy -- so for these styles only identity + product design stay locked.
  allowsVisualChange: boolean;
  // How the final scene should land. The loop-back-to-scene-1 nudge is good for
  // most styles but actively undoes the payoff for before/after (scene 1 IS the
  // "before") and fights the deliberately-unresolved ending of a series.
  endingSemantics: "loop_friendly" | "resolve_payoff" | "open_loop";
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
    narrativeVoiceGuidance:
      "Gaya persuasif direct-response, USP ditegaskan minimal 2x, nada percaya diri MEREKOMENDASIKAN -- seperti endorsement jujur dari orang yang benar-benar pakai produknya, BUKAN skrip iklan generik.",
    ctaIntensity: "hard",
    defaultWpm: 170,
    allowsVisualChange: false,
    endingSemantics: "resolve_payoff",
  },
  vlog_daily: {
    id: "vlog_daily",
    label: "Vlog / Day-in-Life",
    structureDescription:
      "Scene 1 = Opening (perkenalan momen) -> Scene tengah = Momen berurutan (aktivitas natural) -> Scene terakhir = Refleksi/Penutup santai (BUKAN CTA keras)",
    cameraInstruction: "Kamera handheld, sedikit goyang natural, talent bicara sambil beraktivitas.",
    narrativeVoiceGuidance:
      "Gaya cerita personal seperti diary/vlog: ceritakan momen yang baru saja terjadi dengan urutan waktu yang jelas. Natural, tidak scripted, tanpa nada menjual.",
    ctaIntensity: "none",
    defaultWpm: 120,
    // A day-in-life that never changes room, outfit, or time of day isn't a
    // day-in-life.
    allowsVisualChange: true,
    endingSemantics: "loop_friendly",
  },
  tutorial_howto: {
    id: "tutorial_howto",
    label: "Tutorial / How-To",
    structureDescription:
      "Scene 1 = Hook Masalah (sebut masalah/keyword) -> Scene tengah = Langkah 1..N (instruksional bernomor) -> Scene terakhir = Hasil/Recap + ajakan follow",
    cameraInstruction: "Kamera stabil, angle jelas memperlihatkan langkah demi langkah.",
    narrativeVoiceGuidance:
      "Gaya instruksional jelas, sebutkan keyword/topik di awal. Tiap langkah dijelaskan singkat dan actionable, dengan penanda urutan yang natural. Nada membantu, bukan menjual.",
    ctaIntensity: "soft",
    defaultWpm: 135,
    allowsVisualChange: false,
    endingSemantics: "resolve_payoff",
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
    allowsVisualChange: true,
    endingSemantics: "resolve_payoff",
  },
  listicle_countdown: {
    id: "listicle_countdown",
    label: "Listicle / Countdown",
    structureDescription:
      "Scene 1 = Intro (sebutkan total jumlah poin & topik) -> Scene tengah = Poin 1..N (1 scene = 1 poin) -> Scene terakhir = Penutup/rangkuman",
    cameraInstruction: "Kamera stabil, cutaway ke detail tiap poin.",
    narrativeVoiceGuidance:
      "Sebutkan NOMOR poin secara eksplisit di setiap scene, dengan penomoran yang terdengar natural saat diucapkan. Tiap poin harus punya value/insight jelas, bukan filler.",
    ctaIntensity: "soft",
    defaultWpm: 150,
    allowsVisualChange: false,
    endingSemantics: "loop_friendly",
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
    // The contrast IS the format -- locking the visuals identical would make
    // the reveal impossible.
    allowsVisualChange: true,
    // Looping back to scene 1 here means ending on the "before" state, which
    // literally undoes the payoff.
    endingSemantics: "resolve_payoff",
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
    allowsVisualChange: true,
    endingSemantics: "resolve_payoff",
  },
  series_episodic: {
    id: "series_episodic",
    label: "Series / Episodic",
    structureDescription:
      "Scene 1 = Recap singkat/Hook -> Scene tengah = Konten inti -> Scene terakhir = Open Loop (menggantung sengaja, tease part berikutnya)",
    cameraInstruction: "Kamera konsisten dengan identitas visual seri.",
    narrativeVoiceGuidance:
      "Scene terakhir WAJIB diakhiri dengan open loop yang genuinely earned -- beri alasan kuat untuk follow/nunggu part berikutnya. Kalau memang ada kelanjutannya, boleh disinggung bahwa ini bagian pertama dari beberapa; kalau tidak, JANGAN mengarang kelanjutan yang tidak ada.",
    ctaIntensity: "soft",
    defaultWpm: 135,
    allowsVisualChange: false,
    endingSemantics: "open_loop",
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

// Floor/ceiling so an extreme tone adjustment (e.g. heboh_lebay's +15 on an
// already-fast style) can't push the resolved pace somewhere unnatural.
const MIN_WPM = 80;
const MAX_WPM = 220;

export function resolveNarrationWpm(styleId: ContentStyleId, settingsWpm: number | null, tone: LanguageTone): number {
  // An explicit admin override always wins outright -- tone only adjusts the
  // style's researched default, never a deliberate manual value.
  if (settingsWpm !== null && settingsWpm !== UNCUSTOMIZED_WPM_DEFAULT) return settingsWpm;
  const base = getContentStyle(styleId).defaultWpm + getLanguageTone(tone).wpmAdjustment;
  return Math.min(MAX_WPM, Math.max(MIN_WPM, base));
}
