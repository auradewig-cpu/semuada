import type { AiToolId } from "./types";

interface ReferenceGuideSpec {
  steps: string[];
  caution?: string;
}

// Step-by-step "how to attach the reference images" guide per AI video tool --
// each tool has a different UI/workflow for this. Verified against public
// docs/announcements as of early 2026; tool UIs change often, so treat this
// as a starting point, not gospel.
export const REFERENCE_GUIDE: Record<AiToolId, ReferenceGuideSpec> = {
  google_flow: {
    steps: [
      'Buka project di Google Flow, mulai scene baru.',
      'Cari opsi "Add reference image" / "Ingredients" -- upload karakter.jpg dan gambar produk scene ini (maks 3 gambar per subjek).',
      'Tempel teks dari tombol "Copy Prompt" ke kolom prompt.',
      'Generate -- Flow menjaga konsistensi wajah/produk dari gambar referensi yang diupload.',
    ],
  },
  veo3: {
    steps: [
      'Pastikan pakai Veo 3.1 ke atas -- dukungan reference image baru ditambahkan Januari 2026, versi lama belum punya fitur ini.',
      'Upload sampai 3 foto referensi (karakter.jpg + foto produk scene ini) di panel reference sebelum generate.',
      'Tempel "Copy Prompt" ke kolom teks -- dialog di dalam tanda kutip otomatis diucapkan sesuai bahasa isinya, tidak perlu setting bahasa terpisah.',
      'Generate satu scene per satu, ganti reference produk sesuai nomor scene yang sedang dikerjakan.',
    ],
  },
  kling_ai: {
    steps: [
      'Upload karakter.jpg ke "Subject Library" / "Element Binding" -- kalau punya beberapa foto beda angle, upload semua untuk hasil lebih konsisten (1 foto tetap bisa dipakai).',
      'Upload foto produk scene ini sebagai "Element" terpisah.',
      'Tempel "Copy Prompt" ke kolom teks, tag [DIALOGUE: ...] yang sudah ada di teks akan dikenali otomatis.',
      'Generate per scene, ganti Element produk sesuai nomor scene.',
    ],
  },
  runway_gen4: {
    steps: [
      'Drag & drop karakter.jpg dan foto produk scene ini ke kanvas prompting sebagai References (maks 3 gambar).',
      'Opsional: beri nama tiap reference (klik ikon tag) supaya bisa dipanggil pakai @nama di prompt lain kali.',
      'Tempel "Copy Prompt" -- kalau perlu mempertegas mana karakter mana produk, sebut "image_1"/"image_2" atau @nama reference di teks prompt.',
      'Generate.',
    ],
  },
  luma_dream: {
    steps: [
      'Pilih mode "Reference" dari dropdown generate.',
      'Upload karakter.jpg untuk "Character Reference"/"Character Seed" (sampai 4 foto kalau ada, hasil makin konsisten).',
      'Upload foto produk scene ini sebagai reference tambahan.',
      'Tempel "Copy Prompt", generate.',
    ],
  },
  pika_labs: {
    steps: [
      'Gunakan fitur "Scene Ingredients" -- upload karakter.jpg dan foto produk scene ini sebagai ingredients terpisah.',
      'Atau pakai "Character Reference (CREF)" khusus untuk foto karakter kalau tersedia.',
      'Tempel "Copy Prompt", generate.',
    ],
  },
  sora: {
    steps: [
      'Upload foto produk (bukan wajah) sebagai reference visual kalau fitur ini tersedia di akunmu.',
      'Karena upload wajah dibatasi, andalkan deskripsi visual karakter yang detail di "ai_ready_prompt" untuk menjaga konsistensi.',
      'Tempel "Copy Prompt" ke kolom teks, generate.',
    ],
    caution: 'Per kebijakan OpenAI 2026, upload foto wajah manusia (asli maupun AI-generated) diblokir sistem moderasi Sora -- karakter.jpg kemungkinan besar TIDAK BISA diupload langsung.',
  },
};

export function getReferenceGuide(aiTool: AiToolId): ReferenceGuideSpec {
  return REFERENCE_GUIDE[aiTool];
}
