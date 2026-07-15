import { getContentStyle } from "./contentStyles";
import { pickHookPattern } from "./hookPatterns";
import type { ContentStyleId } from "./types";

const TARGET_WPM = 180;

interface MasterPromptInput {
  productName: string;
  category: string;
  price: string;
  sceneCount: number;
  style: ContentStyleId;
  characterName: string | null;
  characterDescription: string | null;
}

export function compileMasterPrompt(input: MasterPromptInput): string {
  const style = getContentStyle(input.style);
  const hook = pickHookPattern(input.sceneCount + input.productName.length);

  const characterBlock = input.characterName
    ? `KARAKTER (WAJIB KONSISTEN DI SETIAP SCENE): "${input.characterName}". ${
        input.characterDescription ?? "Gunakan foto referensi karakter yang dilampirkan sebagai acuan wajah, gaya rambut, dan pakaian — jangan ubah ciri-ciri ini antar scene."
      }`
    : "Tidak ada karakter/talent yang tampil (faceless) — fokus sepenuhnya pada produk dan tangan/voiceover.";

  return `
PERAN: Kamu adalah script writer video affiliate marketing untuk pasar Indonesia tahun 2026, ahli membuat video pendek yang terlihat autentik/real, bukan seperti dibuat AI.

PRODUK:
- Nama: ${input.productName}
- Kategori: ${input.category}
- Harga: Rp ${input.price}

${characterBlock}

GAYA VIDEO: ${style.label}
- Instruksi kamera: ${style.cameraInstruction}
- Instruksi nada bicara: ${style.toneInstruction}

HOOK PATTERN YANG DIPAKAI DI SCENE 1: ${hook}

ATURAN WAJIB (SANGAT PENTING):
1. Buat TEPAT ${input.sceneCount} scene, satu scene untuk setiap foto produk yang dilampirkan berurutan (scene 1 = foto pertama, scene 2 = foto kedua, dst).
2. Narasi harus terdengar natural, TIDAK monoton: intonasi cepat, artikulasi jelas, ada jeda natural sebelum kalimat penting. Target kecepatan bicara ${TARGET_WPM} kata per menit.
3. JANGAN gunakan kata "sempurna", "flawless", "studio quality", "dijamin", "terbukti ampuh 100%" — hindari klaim berlebihan dan bahasa yang terdengar buatan AI.
4. Instruksi kamera harus terasa seperti rekaman HP asli: sedikit tidak simetris, pencahayaan ruangan natural (bukan studio), ada momen kecil yang tidak sempurna (misal jeda sebelum bicara, gerakan tangan yang natural) supaya tidak terlihat "AI banget".
5. Setiap scene wajib punya "ai_ready_prompt": satu paragraf prompt siap-tempel untuk tools video AI (Kling/Veo/Runway/dll) yang menggabungkan deskripsi visual + aksi karakter + arahan kamera dalam bahasa Inggris.
6. Setelah semua scene, buat SATU caption Instagram/TikTok (bahasa Indonesia, singkat, catchy, kekinian) dan TEPAT 5 hashtag relevan (tanpa duplikat, tanpa tanda # ganda).
7. Hitung sendiri jumlah kata narasi tiap scene dan isi ke "script_word_count" — pastikan akurat, jangan asal tebak.

FORMAT OUTPUT — HANYA JSON valid, TIDAK ADA teks lain di luar JSON, dengan struktur persis:
{
  "scenes": [
    {
      "scene_number": number,
      "duration_seconds": number,
      "speech_pace": string,
      "script_narration": string,
      "script_word_count": number,
      "visual_description": string,
      "camera_direction": string,
      "reference_images": { "character": string|null, "product": string },
      "ai_ready_prompt": string
    }
  ],
  "caption": string,
  "hashtags": string[]
}
`.trim();
}
