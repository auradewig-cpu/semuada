import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import type { AiToolId, CameraPattern, NarrationMode } from "./types";

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
  } SETIAP "ai_ready_prompt" WAJIB dimulai dengan deskripsi anchor karakter ini persis kata per kata (continuity token) -- pakai kata kunci fisik/pakaian yang SAMA PERSIS di semua scene (jangan diparafrase jadi sinonim berbeda tiap scene, mis. "kemeja linen biru" jangan berubah jadi "baju biru" di scene lain), baru diikuti deskripsi aksi scene -- tanpa anchor identik, karakter akan terlihat berbeda antar scene saat di-generate ke video tool.`;
}

// The actual bug this fixes: for non-literal-dialogue tools (Kling, Runway,
// Luma, Pika, Sora), the previous instruction told the AI to insert ONLY a
// [DIALOGUE: <language>] tag with no actual words -- the external video tool
// then had zero anchor for what the scene is about or what to say, and would
// freely hallucinate unrelated content/language. Now the real narration text
// is embedded (quoted) alongside the tag for every tool, matching Veo3's
// literal-quote convention just with a language tag prefix.
//
// narrationMode gates this entirely: "voiceover" means the character performs
// silently (VO demo / non-sync) and NO dialogue tag or quoted speech should
// appear at all -- only "lipsync" uses the tool-specific dialogue convention.
export function buildDialogueRule(aiTool: AiToolId, narrationMode: NarrationMode): string {
  if (narrationMode === "voiceover") {
    const charLimit = getAiToolSpec(aiTool).charLimit;
    return `Mode narasi VOICEOVER (non-sync) -- karakter beraktivitas/memperagakan produk (silent demo/action), TIDAK melakukan lipsync. JANGAN sisipkan dialog terkutip, tag [DIALOGUE: ...], frasa "says" dari karakter, atau kutipan ucapan apapun ke "ai_ready_prompt" -- ABAIKAN SEPENUHNYA instruksi konvensi dialog di bagian format AI video tool manapun untuk scene ini, itu HANYA berlaku untuk scene bermode lipsync.
KUNCI SUPAYA MULUT KARAKTER TIDAK IKUT BERGERAK BICARA (riset 2026 -- larangan negatif SAJA tidak cukup, AI video tool tetap otomatis generate gerak bibir bicara kalau audio channel dibiarkan ambigu, karena modelnya "reach for dialogue" secara default kalau tidak diberi tahu audio itu suara siapa):
1. WAJIB isi audio channel secara POSITIF dengan me-redirect eksplisit ke narator eksternal -- sisipkan frasa PENDEK di ai_ready_prompt dengan pola: an off-screen Indonesian-language narrator voice explains the product, the on-screen woman does not speak. Ini memberi AI video tool sesuatu SPESIFIK untuk mengisi audio, bukan cuma larangan. JANGAN kutip ulang seluruh script_narration verbatim di sini -- ai_ready_prompt punya batas ${charLimit} karakter, frasa redirect ini harus ringkas supaya tidak menghabiskan jatah karakter untuk deskripsi karakter/produk/kamera yang sudah wajib ada.
2. Sebutkan SEKALI (jangan diulang-ulang, pengulangan larangan "no talking"/"silent" berkali-kali justru bikin model makin fokus ke konsep "talking") bahwa karakter di layar mulutnya diam dan tidak bergerak sepanjang scene, ditulis sebagai bagian natural dari deskripsi fisik/aksi, bukan sebagai daftar larangan terpisah-pisah.
3. JANGAN gambarkan setup mirip microphone/wawancara/podcast (mis. karakter menghadap kamera dari dekat seolah sedang ngobrol) -- itu memicu AI video tool otomatis menganggap ada percakapan berlangsung.`;
  }
  const toolSpec = getAiToolSpec(aiTool);
  if (usesLiteralDialogueConvention(aiTool)) {
    return `Dialog WAJIB disisipkan sebagai kutipan literal persis begini: [Subjek] says, "<script_narration WORD-FOR-WORD, SAMA PERSIS dengan field script_narration, JANGAN diterjemahkan/diparafrase>" (no subtitles). Ini konvensi resmi ${toolSpec.label} -- model menyimpulkan bahasa ucapan dari ISI kalimat dalam kutip, bukan label bahasa.`;
  }
  return `Dialog WAJIB disisipkan persis begini: [DIALOGUE: Bahasa Indonesia] "<script_narration WORD-FOR-WORD, SAMA PERSIS dengan field script_narration, JANGAN diterjemahkan/diparafrase/dikosongkan>". WAJIB sertakan kutipan narasi asli, BUKAN hanya tag kosong -- tanpa kutipan ini AI video tool tidak tahu harus mengucapkan/menampilkan apa dan akan mengarang konten/dialog sendiri yang bisa melenceng jauh dari produk.`;
}

// A-roll/B-roll intercutting -- alternates character shots with product
// cutaways within/across scenes, a standard UGC-ad pattern that keeps
// completion rate high by changing visuals every few seconds.
export function buildCameraPatternRule(pattern: CameraPattern): string {
  if (pattern === "aroll_broll") {
    return `POLA KAMERA: A-ROLL/B-ROLL INTERCUTTING -- "camera_direction" WAJIB menyelingi shot karakter (A-roll, fokus wajah/aksi karakter) dengan cutaway close-up produk (B-roll, angle/fokus berbeda, mis. zoom ke detail produk di tangan). Tiap scene idealnya punya minimal satu momen cutaway ke produk sebelum kembali ke karakter -- pola ini terbukti menjaga perhatian penonton lebih lama.`;
  }
  return `POLA KAMERA: SINGLE ANGLE -- "camera_direction" fokus konsisten pada satu angle/subjek per scene tanpa cutaway bergantian, mengikuti gaya video yang dipilih.`;
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
