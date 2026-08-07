import { pickExamples, deriveSeed, SPOKEN_PRICE_BANK } from "./exampleBank";

// Ported from ViralFrame Studio's negativePrompt.ts -- field-tested constraints
// that keep character/product appearance identical across scenes and stop AI
// video tools from hallucinating extra objects/broken anatomy. Import from here,
// never copy-paste this text elsewhere.
export interface NegativePromptOptions {
  // Cross-scene consistency rules are meaningless for a 1-scene video and
  // actively wrong for hook variants (which are mutually exclusive ALTERNATIVES
  // of the same scene, not a sequence) -- previously the block was emitted
  // unconditionally from all three builders and burned ~15 bullets of the
  // instruction budget saying nothing.
  sceneCount: number;
  // Styles whose entire premise is visual change (before/after, twist reveal,
  // day-in-life) cannot honour locked setting/lighting/wardrobe. For those,
  // only identity and product design stay locked. See contentStyles.ts.
  allowsVisualChange: boolean;
  // Kling and Runway expose a DEDICATED negative-prompt input. Forcing the
  // negatives into the positive prompt for those tools is the single most
  // documented way to summon the very artifacts being banned.
  supportsNegativePromptField: boolean;
}

export function buildNegativePromptBlock(options: NegativePromptOptions): string {
  const { sceneCount, allowsVisualChange, supportsNegativePromptField } = options;
  const sections: string[] = [];

  if (sceneCount > 1) {
    const alwaysLocked = [
      "- Identitas & ciri fisik karakter/tangan (wajah, rambut, warna kulit)",
      "- Bentuk, warna, dan desain produk",
    ];
    const conditionallyLocked = allowsVisualChange
      ? []
      : [
          "- Lokasi/setting dasar",
          "- Arah dan suhu cahaya (lighting direction & color temperature)",
          "- Wardrobe/pakaian karakter",
          "- Color grading keseluruhan",
        ];
    const changeNote = allowsVisualChange
      ? `\nGaya video ini MEMANG menuntut perubahan visual antar scene, jadi lokasi, cahaya, wardrobe, dan color grading BOLEH berubah mengikuti alur cerita -- yang tidak boleh berubah hanya dua poin di atas.`
      : "";
    sections.push(
      `[KONSISTENSI ANTAR SCENE]\nElemen berikut WAJIB identik persis di semua scene:\n${[...alwaysLocked, ...conditionallyLocked].join("\n")}${changeNote}`
    );
  }

  // Two different techniques depending on the tool. Both keep the banned terms
  // OUT of the positive prompt text -- writing "extra fingers, distorted face"
  // into a positive prompt is what produces extra fingers and distorted faces.
  sections.push(
    supportsNegativePromptField
      ? `[NEGATIVE PROMPT -- FIELD TERPISAH]
Tool ini punya input negative prompt tersendiri. Isi field "negative_prompt" dengan daftar istilah singkat dipisah koma (English), mis. hal-hal seperti anatomi tangan rusak, objek/orang tambahan, teks acak di background, perubahan desain produk. JANGAN menuliskan istilah larangan ini di dalam "ai_ready_prompt" -- menyebut artefak di prompt positif justru memicu artefak itu muncul.`
      : `[HINDARI ARTEFAK -- TANPA MENYEBUTKANNYA]
Tool ini TIDAK punya input negative prompt terpisah. Tulis "ai_ready_prompt" secara POSITIF dan spesifik supaya tidak ada ruang bagi AI video tool menghasilkan anatomi tangan/wajah yang rusak, objek atau orang tambahan yang tidak diminta, teks acak di background, atau perubahan desain produk. Caranya dengan menyebutkan secara tegas apa yang HARUS ada di frame (jumlah tangan, posisi produk, latar yang bersih), BUKAN dengan menuliskan daftar larangan -- menyebut nama artefaknya di prompt positif justru memicu artefak itu muncul.`
  );

  return sections.join("\n\n");
}

// The example price is drawn per-request from SPOKEN_PRICE_BANK instead of
// being hardcoded. The previous hardcoded examples ("empat setengah miliar",
// "dua ratus lima puluh lima meter") were leftovers from a property-listing
// project: wrong domain and 4-5 orders of magnitude off for affiliate
// products, and they were injected into every prompt from all three builders.
export function buildSpokenNumberRule(seed: number): string {
  const [example] = pickExamples(SPOKEN_PRICE_BANK, 1, deriveSeed(seed, 7));
  return `ANGKA DALAM NARASI WAJIB diucapkan dalam bentuk lisan yang natural, bukan dibaca digit per digit. HINDARI kata "koma" kecuali benar-benar tak terhindarkan. Harga dibulatkan ke bentuk lisan yang wajar kalau konteksnya santai. Contoh pola (JANGAN disalin, sesuaikan dengan harga produk yang sebenarnya): ${example}.`;
}
