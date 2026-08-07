import { pickExamples, formatExamples, deriveSeed, TONE_PHRASE_BANK } from "./exampleBank";
import type { LanguageTone } from "./types";

interface LanguageToneDefinition {
  id: LanguageTone;
  label: string;
  blurb: string;
  // Describes the REGISTER only -- concrete vocabulary lives in
  // exampleBank.ts's TONE_PHRASE_BANK and is rotated per request. Keeping a
  // fixed phrase list here is what made every gaul_kekinian script reach for
  // the same eight slang words.
  instruction: string;
  // Replaces masterPrompt.ts/sceneRegen.ts's hardcoded "under 12 words" cap --
  // deliberately per-tone, not a single global number, since e.g. heboh_lebay
  // needs SHORT punchy bursts while santai_ngobrol needs longer flowing ones.
  maxWordsPerSentence: number;
  // Added to the content style's defaultWpm in resolveNarrationWpm() -- can
  // be negative (curhat_personal, elegan_premium want a slower pace).
  wpmAdjustment: number;
}

export const LANGUAGE_TONES: Record<LanguageTone, LanguageToneDefinition> = {
  formal_netral: {
    id: "formal_netral",
    label: "Formal/Netral",
    blurb: "Bahasa Indonesia baku namun ramah -- baseline, tanpa slang.",
    instruction:
      "Bahasa Indonesia baku namun tetap ramah dan tidak kaku. Hindari slang, kalimat jelas dan lugas.",
    maxWordsPerSentence: 12,
    wpmAdjustment: 0,
  },
  santai_ngobrol: {
    id: "santai_ngobrol",
    label: "Santai/Ngobrol",
    blurb: "Kayak ngobrol sama temen deket, mengalir natural.",
    instruction:
      'Ngobrol kayak sama temen deket, BUKAN baca naskah. Kalimat boleh lebih panjang & mengalir, disambung kata sambung natural. Pakai kata ganti "aku/kamu" atau "gue/lo" sesuai konteks produk. Selipkan filler natural secukupnya ("sih", "deh", "dong", "kan") -- jangan sampai tiap kalimat penuh filler.',
    maxWordsPerSentence: 20,
    wpmAdjustment: 10,
  },
  gaul_kekinian: {
    id: "gaul_kekinian",
    label: "Gaul/Kekinian",
    blurb: "Slang anak muda Indonesia terkini, ekspresif.",
    instruction:
      "Bahasa gaul anak muda Indonesia terkini, ekspresif dan hidup. Kalimat boleh mengalir panjang dengan energi tinggi. Slang dipakai secukupnya sesuai konteks -- jangan dipaksakan di tiap kalimat sampai kalimatnya jadi tidak masuk akal.",
    maxWordsPerSentence: 20,
    wpmAdjustment: 12,
  },
  elegan_premium: {
    id: "elegan_premium",
    label: "Elegan/Premium",
    blurb: "Halus, tenang, kesan mewah -- tanpa slang.",
    instruction:
      "Bahasa halus dan terpilih, kesan mewah/eksklusif. Hindari slang dan kata seru berlebihan. Tempo tenang, tidak terburu-buru, tiap kata terasa dipilih dengan sengaja.",
    maxWordsPerSentence: 14,
    wpmAdjustment: -5,
  },
  heboh_lebay: {
    id: "heboh_lebay",
    label: "Heboh/Lebay",
    blurb: "Reaksi berlebihan penuh semangat -- energi dari intensitas, bukan panjang kalimat.",
    instruction:
      "Reaksi berlebihan penuh semangat dari detik pertama. Nada excited terus-menerus, banyak penekanan. Energi datang dari INTENSITAS kalimat PENDEK yang meledak-ledak, BUKAN dari kalimat panjang -- jaga tiap kalimat singkat dan padat.",
    maxWordsPerSentence: 10,
    wpmAdjustment: 15,
  },
  kocak_receh: {
    id: "kocak_receh",
    label: "Kocak/Receh",
    blurb: "Humor ringan, self-deprecating jokes.",
    instruction:
      "Nada bercanda, receh, humor self-deprecating ringan (bercanda ke diri sendiri, bukan menjelekkan orang lain/produk). Boleh ada punchline kecil di akhir kalimat. Humor terasa natural, bukan dipaksakan.",
    maxWordsPerSentence: 18,
    wpmAdjustment: 8,
  },
  sotoy_santai: {
    id: "sotoy_santai",
    label: "Sotoy Santai",
    blurb: 'Kayak "temen yang paham banget", tanpa gaya menggurui.',
    instruction:
      "Kayak temen yang paham banget soal produk ini, jelasin santai TANPA gaya menggurui/dosen. Pakai jembatan penjelasan yang natural. Tetap informatif tapi rileks, bukan formal.",
    maxWordsPerSentence: 16,
    wpmAdjustment: 5,
  },
  curhat_personal: {
    id: "curhat_personal",
    label: "Curhat/Personal",
    blurb: "Nada vulnerable, cerita pribadi, ritme reflektif.",
    instruction:
      "Nada vulnerable dan personal, seperti cerita ke sahabat dekat. Pembukanya reflektif dan jujur. Ritme lebih pelan, ada jeda emosional di kalimat yang penting -- ini BUKAN gaya energik, tempo dibuat lebih tenang dari biasanya.",
    maxWordsPerSentence: 18,
    wpmAdjustment: -10,
  },
  sarkas_julid: {
    id: "sarkas_julid",
    label: "Sarkas/Julid Dikit",
    blurb: "Nyeletuk jenaka, sindiran ringan -- tetap sopan.",
    instruction:
      'Nyeletuk jenaka dengan sedikit sindiran ringan bergaya "julid" -- dipahami sebagai bercanda, BUKAN menyerang atau kasar. Sindiran HANYA ke kebiasaan/anggapan umum (mis. kebiasaan boros, mitos produk), TIDAK PERNAH ke individu, kelompok, SARA, atau pihak lain manapun -- tetap sopan meski nadanya usil.',
    maxWordsPerSentence: 16,
    wpmAdjustment: 5,
  },
  ibu_bapack_relatable: {
    id: "ibu_bapack_relatable",
    label: "Ibu-ibu/Bapack Relatable",
    blurb: "Nada obrolan sesama orang tua, hangat dan peduli.",
    instruction:
      'Nada ngobrol sesama orang tua, hangat dan relatable. Sapaan natural sesuai konteks: "Bun/Bunda", "Ayah/Bapak". Nada peduli dan pengertian, BUKAN menggurui. Kalau produknya tidak berhubungan dengan anak/rumah tangga, tetap pakai nada hangat itu TANPA memaksakan konteks anak/rumah tangga.',
    maxWordsPerSentence: 16,
    wpmAdjustment: 3,
  },
};

export function getLanguageTone(id: LanguageTone): LanguageToneDefinition {
  return LANGUAGE_TONES[id];
}

// The example phrases are a rotating sample, not a fixed list, and are labelled
// as inspiration rather than a script -- an unrotated list gets copied verbatim
// into every generation, which is precisely what made consecutive scripts for
// the same product read as near-duplicates.
export function buildLanguageToneRule(tone: LanguageTone, seed: number): string {
  const spec = getLanguageTone(tone);
  const picked = pickExamples(TONE_PHRASE_BANK[tone], 4, deriveSeed(seed, 1));
  return `GAYA BAHASA: ${spec.label} -- ${spec.instruction}
Beberapa contoh rasa bahasanya: ${formatExamples(picked)}. Ini HANYA gambaran rasa, BUKAN daftar yang harus dipakai -- susun kalimatmu sendiri dengan nuansa serupa, jangan menyalin contoh di atas mentah-mentah.`;
}
