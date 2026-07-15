import { getContentStyle } from "./contentStyles";
import { buildHookInstruction } from "./hookPatterns";
import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import { getPlatformSpec } from "./platforms";
import { getCtaType, resolveCtaForGoal } from "./ctaTypes";
import { NEGATIVE_PROMPT_BLOCK, SPOKEN_NUMBER_RULE } from "./negativePrompt";
import type { AiToolId, AspectRatio, ContentGoal, ContentStyleId, CtaTypeId, HookArchetype, PlatformTarget } from "./types";

interface MasterPromptInput {
  productName: string;
  category: string;
  price: string;
  sceneDurations: number[];
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  characterName: string | null;
  characterDescription: string | null;
  narrationWpm: number;
}

export function compileMasterPrompt(input: MasterPromptInput): string {
  const style = getContentStyle(input.style);
  const toolSpec = getAiToolSpec(input.aiTool);
  const platformSpec = getPlatformSpec(input.platform);
  const sceneCount = input.sceneDurations.length;
  const hookInstruction = buildHookInstruction(input.hookArchetype, input.platform, input.sceneDurations[0]);
  const effectiveCta = resolveCtaForGoal(input.ctaType, input.contentGoal);
  const ctaSpec = getCtaType(effectiveCta);

  const characterBlock = input.characterName
    ? `KARAKTER (WAJIB KONSISTEN DI SETIAP SCENE): "${input.characterName}". ${
        input.characterDescription ?? "Gunakan foto referensi karakter yang dilampirkan sebagai acuan wajah, gaya rambut, dan pakaian -- jangan ubah ciri-ciri ini antar scene."
      } SETIAP "ai_ready_prompt" WAJIB dimulai dengan deskripsi anchor karakter ini persis kata per kata, baru diikuti deskripsi aksi scene -- tanpa anchor identik, karakter akan terlihat berbeda antar scene.`
    : "Tidak ada karakter/talent yang tampil (faceless) -- fokus sepenuhnya pada produk dan tangan/voiceover.";

  const dialogueRule = usesLiteralDialogueConvention(input.aiTool)
    ? `Dialog WAJIB disisipkan sebagai kutipan literal persis begini: [Subjek] says, "<script_narration WORD-FOR-WORD, SAMA PERSIS dengan field script_narration, JANGAN diterjemahkan/diparafrase>" (no subtitles). Ini konvensi resmi ${toolSpec.label} -- model menyimpulkan bahasa ucapan dari ISI kalimat dalam kutip, bukan label bahasa.`
    : `Sisipkan tag [DIALOGUE: Bahasa Indonesia] setelah deskripsi visual scene (HANYA nama bahasa di dalam tag, bukan kalimat penuh) -- tanpa tag ini AI video tool cenderung menghasilkan dialog berbahasa Inggris.`;

  const ctaGoalNote =
    input.contentGoal === "growth"
      ? "TUJUAN KONTEN: Growth akun -- TANPA bahasa jualan sama sekali, hook & CTA murni ke follow/save/share/comment."
      : input.contentGoal === "engagement"
        ? "TUJUAN KONTEN: Engagement -- pancing komentar/interaksi, CTA soft."
        : "TUJUAN KONTEN: Konversi -- CTA sesuai gaya konten standar.";

  const loopEndingRule =
    style.ctaIntensity !== "hard"
      ? `Scene terakhir ("transition_to_next") sebaiknya menggestur balik ke visual/tema scene 1 (loop-friendly) -- endingan yang mengundang tonton ulang dihitung sebagai engagement tinggi oleh algoritma, khususnya di Reels.`
      : `Scene terakhir WAJIB ditutup dengan CTA yang jelas dan tegas sesuai gaya konten ini.`;

  const captionShareNote =
    input.platform === "instagram_reels" || input.platform === "facebook_reels"
      ? `Caption sebaiknya memakai frasa yang mengundang dikirim ke teman (mis. "kirim ke temen yang lagi butuh ini") -- DM-share adalah sinyal reach terkuat di platform ini pada 2026.`
      : "";

  return `
PERAN: Kamu adalah script writer video affiliate marketing untuk pasar Indonesia tahun 2026, ahli membuat video pendek yang terlihat autentik/real, bukan seperti dibuat AI.

PRODUK:
- Nama: ${input.productName}
- Kategori: ${input.category}
- Harga: Rp ${input.price}

${characterBlock}

GAYA VIDEO: ${style.label}
Struktur: ${style.structureDescription}
- Instruksi kamera: ${style.cameraInstruction}
- Instruksi nada bicara: ${style.narrativeVoiceGuidance}

PLATFORM TUJUAN: ${platformSpec.label} (rasio ${input.aspectRatio}, durasi total ${input.sceneDurations.reduce((a, b) => a + b, 0)}s)
${platformSpec.behavior}

AI VIDEO TOOL TUJUAN: ${toolSpec.label} (batas karakter ai_ready_prompt: ${toolSpec.charLimit})
Format ai_ready_prompt: ${toolSpec.formatTemplate}

HOOK SCENE 1: ${hookInstruction}

${ctaGoalNote}
CTA: ${ctaSpec.instruction}
${loopEndingRule}
${captionShareNote}

ATURAN WAJIB (SANGAT PENTING):
1. Buat TEPAT ${sceneCount} scene, satu scene untuk setiap foto produk yang dilampirkan berurutan (scene 1 = foto pertama, scene 2 = foto kedua, dst).
2. Durasi tiap scene SUDAH DITENTUKAN dan TIDAK BOLEH diubah: ${input.sceneDurations.map((d, i) => `scene ${i + 1} = ${d}s`).join(", ")}.
3. BAHASA PER FIELD (WAJIB DIPATUHI PERSIS): "script_narration" WAJIB Bahasa Indonesia. "visual_description", "camera_direction", dan "ai_ready_prompt" WAJIB Bahasa Inggris (English) -- field-field ini dibaca oleh AI video tool, bukan manusia Indonesia.
4. Narasi harus terdengar natural, TIDAK monoton: intonasi cepat, artikulasi jelas, ada jeda natural sebelum kalimat penting. Target kecepatan bicara ${input.narrationWpm} kata per menit.
5. JANGAN gunakan kata "sempurna", "flawless", "studio quality", "dijamin", "terbukti ampuh 100%" -- hindari klaim berlebihan dan bahasa yang terdengar buatan AI.
6. Instruksi kamera harus terasa seperti rekaman HP asli: sedikit tidak simetris, pencahayaan ruangan natural (bukan studio), ada momen kecil yang tidak sempurna supaya tidak terlihat "AI banget".
7. ${dialogueRule}
8. Tutup ai_ready_prompt dengan penanda "[Xs, ${input.aspectRatio} frame]" (ganti X dengan durasi scene tersebut dalam detik).
9. ${SPOKEN_NUMBER_RULE}
10. Setelah semua scene, buat SATU caption (bahasa Indonesia, singkat, catchy, kekinian) dan TEPAT 5 hashtag relevan (tanpa duplikat, tanpa tanda # ganda).
11. Hitung sendiri jumlah kata narasi tiap scene dan isi ke "script_word_count" -- pastikan akurat, jangan asal tebak.

${NEGATIVE_PROMPT_BLOCK}

FORMAT OUTPUT -- HANYA JSON valid, TIDAK ADA teks lain di luar JSON, dengan struktur persis:
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
      "transition_to_next": string,
      "reference_images": { "character": string|null, "product": string },
      "ai_ready_prompt": string
    }
  ],
  "caption": string,
  "hashtags": string[]
}
`.trim();
}
