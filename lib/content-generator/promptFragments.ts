import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import type { AiToolId } from "./types";

// Shared prompt fragments used by masterPrompt.ts, sceneRegen.ts, and
// hookVariants.ts -- extracted so the character-anchor and dialogue-language
// instructions can't drift between the three call sites (previously each
// file reimplemented these with slightly different wording).

export function buildCharacterBlock(characterName: string | null, characterDescription: string | null): string {
  if (!characterName) {
    return "Tidak ada karakter/talent yang tampil (faceless) -- fokus sepenuhnya pada produk dan tangan/voiceover.";
  }
  return `KARAKTER (WAJIB KONSISTEN DI SETIAP SCENE): "${characterName}". ${
    characterDescription ?? "Gunakan foto referensi karakter yang dilampirkan sebagai acuan wajah, gaya rambut, dan pakaian -- jangan ubah ciri-ciri ini antar scene."
  } SETIAP "ai_ready_prompt" WAJIB dimulai dengan deskripsi anchor karakter ini persis kata per kata, baru diikuti deskripsi aksi scene -- tanpa anchor identik, karakter akan terlihat berbeda antar scene.`;
}

// The actual bug this fixes: for non-literal-dialogue tools (Kling, Runway,
// Luma, Pika, Sora), the previous instruction told the AI to insert ONLY a
// [DIALOGUE: <language>] tag with no actual words -- the external video tool
// then had zero anchor for what the scene is about or what to say, and would
// freely hallucinate unrelated content/language. Now the real narration text
// is embedded (quoted) alongside the tag for every tool, matching Veo3's
// literal-quote convention just with a language tag prefix.
export function buildDialogueRule(aiTool: AiToolId): string {
  const toolSpec = getAiToolSpec(aiTool);
  if (usesLiteralDialogueConvention(aiTool)) {
    return `Dialog WAJIB disisipkan sebagai kutipan literal persis begini: [Subjek] says, "<script_narration WORD-FOR-WORD, SAMA PERSIS dengan field script_narration, JANGAN diterjemahkan/diparafrase>" (no subtitles). Ini konvensi resmi ${toolSpec.label} -- model menyimpulkan bahasa ucapan dari ISI kalimat dalam kutip, bukan label bahasa.`;
  }
  return `Dialog WAJIB disisipkan persis begini: [DIALOGUE: Bahasa Indonesia] "<script_narration WORD-FOR-WORD, SAMA PERSIS dengan field script_narration, JANGAN diterjemahkan/diparafrase/dikosongkan>". WAJIB sertakan kutipan narasi asli, BUKAN hanya tag kosong -- tanpa kutipan ini AI video tool tidak tahu harus mengucapkan/menampilkan apa dan akan mengarang konten/dialog sendiri yang bisa melenceng jauh dari produk.`;
}

// Anchors scene content to the actual selected product -- the second half of
// the same bug: without an explicit "don't substitute the product/scenario"
// rule, a vague visual_description gives the AI (or the external video tool
// reading ai_ready_prompt) room to drift into unrelated content.
export function buildProductAnchorRule(productName: string, category: string): string {
  return `SETIAP "ai_ready_prompt" dan "visual_description" WAJIB secara eksplisit tentang produk "${productName}" (kategori ${category}) -- sebutkan jenis produknya jelas di kalimat pertama. DILARANG KERAS mengganti dengan produk lain, skenario lain, atau konten yang tidak diminta (mis. kalau produknya smartwatch, JANGAN membuat video tentang memasak/makanan atau produk lain apapun).`;
}

// Line shown in the PRODUK block -- omits the price entirely when the user
// turns price-mentioning off, so the AI never even sees the number.
export function buildProductPriceLine(price: string, includePrice: boolean): string {
  return includePrice ? `- Harga: Rp ${price}` : "";
}

// Explicit rule so the AI doesn't invent or infer a price from context
// (style/CTA text can still imply "murah"/"affordable" without a number).
export function buildPriceRule(includePrice: boolean): string {
  return includePrice
    ? `Harga produk BOLEH disebut di narasi jika mendukung hook/CTA, sebutkan dalam bentuk lisan natural (lihat aturan angka di bawah).`
    : `DILARANG menyebutkan harga produk dalam bentuk apapun (angka, "murah", "terjangkau", atau perbandingan harga) di "script_narration" maupun "ai_ready_prompt" -- harga TIDAK boleh muncul sama sekali di video ini.`;
}
