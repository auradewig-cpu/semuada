import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import type { AiToolId, CameraPattern, ContentGoal, NarrationMode } from "./types";

// Shared prompt fragments used by masterPrompt.ts, sceneRegen.ts, and
// hookVariants.ts -- extracted so the character-anchor and dialogue-language
// instructions can't drift between the three call sites (previously each
// file reimplemented these with slightly different wording).

export function buildCharacterBlock(characterName: string | null, characterDescription: string | null): string {
  if (!characterName) {
    // Previously this said only "produk dan tangan/voiceover", which silently
    // ruled out the other standard faceless formats.
    return `Tidak ada karakter/talent yang tampil (FACELESS) -- tidak boleh ada wajah manusia di frame sama sekali. Format yang boleh dipakai: tangan saja yang memegang/memperagakan produk, produk berdiri sendiri di permukaan (flat-lay atau product-only), atau kombinasi keduanya. Pilih format yang paling masuk akal untuk produk ini dan pakai konsisten.`;
  }
  return `KARAKTER (WAJIB KONSISTEN DI SETIAP SCENE): "${characterName}". ${
    characterDescription ?? "Gunakan foto referensi karakter yang dilampirkan sebagai acuan wajah, gaya rambut, dan pakaian -- jangan ubah ciri-ciri ini antar scene."
  } SETIAP "ai_ready_prompt" WAJIB dimulai dengan deskripsi anchor karakter ini, memakai frasa yang SAMA PERSIS di semua scene -- tulis sekali, lalu salin frasa itu apa adanya ke scene berikutnya, JANGAN diparafrase jadi sinonim yang berbeda tiap scene (istilah warna/bahan/potongan pakaian harus identik kata per kata). Setelah anchor, baru deskripsi aksi scene. Tanpa anchor yang identik, karakter akan terlihat seperti orang berbeda antar scene saat di-generate ke video tool.`;
}

// narrationMode gates the dialogue convention: "voiceover" means the subject
// performs silently (VO demo / non-sync) and NO dialogue tag or quoted speech
// should appear -- only "lipsync" uses the tool-specific dialogue convention.
//
// hasCharacter matters because the voiceover branch used to assert an on-screen
// person unconditionally (and hardcoded her gender), which contradicted faceless
// mode outright. It also decides how to handle faceless+lipsync, which is the
// DEFAULT state when no character is picked and which is self-contradictory:
// there is no mouth to sync.
export function buildDialogueRule(aiTool: AiToolId, narrationMode: NarrationMode, hasCharacter: boolean): string {
  const toolSpec = getAiToolSpec(aiTool);

  // Faceless + lipsync can't be honoured literally, so resolve it to the only
  // coherent reading (narration as voiceover) instead of demanding a speaker
  // that the character block just said doesn't exist. The route surfaces a
  // warning so the user knows their selection was reinterpreted.
  const effectiveMode: NarrationMode = !hasCharacter && narrationMode === "lipsync" ? "voiceover" : narrationMode;

  if (effectiveMode === "voiceover") {
    const subject = hasCharacter ? "orang di layar" : "tangan/produk di layar";
    // Deliberately describes WHAT the audio clause must convey rather than
    // dictating the sentence itself. The previous version supplied a
    // ready-made English sentence, which every generation then copied
    // verbatim -- four consecutive outputs opened with the identical line.
    return `MODE NARASI: VOICEOVER (non-sync) -- ${subject} TIDAK bicara, narasi datang dari narator di luar frame. JANGAN sisipkan kutipan ucapan, tag [DIALOGUE: ...], atau frasa "says" ke "ai_ready_prompt".
Isi audio channel secara POSITIF (larangan saja tidak cukup -- kalau audio dibiarkan ambigu, AI video tool otomatis membuat mulut bergerak bicara): tulis SATU klausa audio singkat dalam bahasa Inggris yang menyatakan narator berbahasa Indonesia di luar frame menjelaskan produk, dan subjek di layar tidak bicara. SUSUN KALIMATNYA SENDIRI dengan kata-katamu, berbeda tiap scene -- jangan memakai rumusan yang sama persis berulang kali. Jangan mengutip ulang script_narration di sini (batas ${toolSpec.charLimit} karakter), dan jangan menggambarkan setup mirip wawancara/podcast yang memicu kesan sedang bercakap-cakap.`;
  }

  if (usesLiteralDialogueConvention(aiTool)) {
    return `MODE NARASI: LIPSYNC -- dialog WAJIB disisipkan sebagai kutipan literal dengan pola: [Subjek] says, "<isi script_narration WORD-FOR-WORD, JANGAN diterjemahkan/diparafrase>" (no subtitles). Ini konvensi resmi ${toolSpec.label} -- model menyimpulkan bahasa ucapan dari ISI kalimat dalam kutip, bukan dari label bahasa.`;
  }
  return `MODE NARASI: LIPSYNC -- dialog WAJIB disisipkan dengan pola: [DIALOGUE: Bahasa Indonesia] "<isi script_narration WORD-FOR-WORD, JANGAN diterjemahkan/diparafrase/dikosongkan>". WAJIB sertakan kutipan narasi aslinya, BUKAN tag kosong -- tanpa itu AI video tool tidak tahu harus mengucapkan apa dan akan mengarang dialog sendiri yang melenceng dari produk.`;
}

// Reports whether buildDialogueRule() had to reinterpret the requested mode, so
// the route can warn the user instead of silently changing their selection.
export function narrationModeWasCoerced(narrationMode: NarrationMode, hasCharacter: boolean): boolean {
  return !hasCharacter && narrationMode === "lipsync";
}

// A-roll/B-roll intercutting -- alternates character shots with product
// cutaways within/across scenes, a standard UGC-ad pattern that keeps
// completion rate high by changing visuals every few seconds.
export function buildCameraPatternRule(pattern: CameraPattern): string {
  if (pattern === "aroll_broll") {
    // Scoped explicitly to camera_direction (an editing note). One
    // ai_ready_prompt is ONE continuous generation on every supported tool, so
    // a cutaway described there produces a morphing single take rather than a
    // cut -- see buildSingleTakeRule().
    return `POLA KAMERA: A-ROLL/B-ROLL INTERCUTTING -- HANYA berlaku untuk field "camera_direction" sebagai catatan editing, BUKAN untuk "ai_ready_prompt". Di "camera_direction", selang-seling shot subjek (A-roll) dengan cutaway close-up produk (B-roll, angle/fokus berbeda). Tiap scene idealnya punya minimal satu momen cutaway ke produk sebelum kembali ke subjek -- pola ini terbukti menjaga perhatian penonton lebih lama.`;
  }
  return `POLA KAMERA: SINGLE ANGLE -- "camera_direction" fokus konsisten pada satu angle/subjek per scene tanpa cutaway bergantian, mengikuti gaya video yang dipilih.`;
}

// Anchors scene content to the actual selected product. The old version named a
// counter-example product and an unrelated activity, which is the classic
// "don't think of an elephant" construction sitting inside the anti-drift rule.
export function buildProductAnchorRule(productName: string, category: string): string {
  return `SETIAP "ai_ready_prompt" dan "visual_description" WAJIB secara eksplisit tentang produk "${productName}" (kategori ${category}) -- sebutkan jenis produknya dengan jelas di kalimat pertama. DILARANG KERAS menggantinya dengan produk lain, aktivitas lain, atau skenario yang tidak berhubungan dengan produk ini.`;
}

// Line shown in the PRODUK block -- omits the price entirely when the user
// turns price-mentioning off, so the AI never even sees the number.
export function buildProductPriceLine(price: string, includePrice: boolean): string {
  return includePrice ? `- Harga: Rp ${price}` : "";
}

// Explicit rule so the AI doesn't invent or infer a price from context
// (style/CTA text can still imply "murah"/"affordable" without a number).
// Previously "BOLEH disebut" (optional) -- with many other WAJIB instructions
// competing for a tiny word budget on short/single-scene generations, an
// optional instruction was consistently the first thing dropped, so users
// who explicitly turned the price toggle ON never saw a price in the output.
export function buildPriceRule(includePrice: boolean, sceneCount: number | undefined, contentGoal: ContentGoal): string {
  if (!includePrice) {
    return `DILARANG menyebutkan harga produk dalam bentuk apapun (angka, "murah", "terjangkau", atau perbandingan harga) di "script_narration" maupun "ai_ready_prompt" -- harga TIDAK boleh muncul sama sekali di video ini.`;
  }
  // Growth mode bans commercial language outright. A WAJIB price rule would win
  // that fight (it's stated more forcefully), producing exactly the sell-y
  // narration growth mode exists to avoid -- so it yields here instead.
  if (contentGoal === "growth") {
    return `Harga BOLEH disinggung sekilas hanya kalau benar-benar natural, TANPA gaya jualan (tanpa "promo", "diskon", "murah banget"). Tujuan konten ini growth akun, jadi kalau menyebut harga membuat narasinya terdengar seperti iklan, lebih baik dilewati.`;
  }
  const singleSceneNote =
    sceneCount === 1
      ? ` Karena video ini HANYA 1 scene (hook dan CTA jadi satu), prioritaskan menyingkat bagian lain (hook/CTA) SEBELUM mengorbankan harga -- harga TETAP HARUS ada meski ruang kata terbatas.`
      : "";
  return `Harga produk WAJIB disebutkan minimal SATU KALI di narasi (bukan opsional), dalam bentuk lisan natural (lihat aturan angka di bawah), di bagian yang paling mendukung hook/CTA.${singleSceneNote}`;
}

// Universal delivery-technique instructions, independent of GAYA BAHASA
// (vocabulary/energy) and GAYA VIDEO (structure) -- addresses what neither
// covers: HOW a genuine affiliator/influencer actually talks, vs. reading
// out an ad script. Tone controls word choice; this controls the shape of
// the delivery itself (address, opening move, story-vs-list, rhythm).
export function buildDeliveryTechniqueRule(): string {
  return `TEKNIK PENYAMPAIAN (WAJIB, berlaku di semua gaya bahasa/video di atas):
1. Sapa penonton secara langsung minimal sekali memakai kata ganti orang kedua yang cocok dengan gaya bahasa yang dipilih -- jangan cuma bicara TENTANG produk tanpa pernah bicara KE penonton.
2. Buka dengan reaksi/pengamatan/pertanyaan personal yang hidup, BUKAN pernyataan produk yang datar seperti membaca daftar spesifikasi.
3. Ceritakan pengalaman/reaksi/observasi dulu, baru kaitkan ke manfaat produk -- DILARANG menjejer fitur produk berurutan seperti daftar brosur/katalog.
4. Variasikan ritme kalimat: campur kalimat pendek yang tegas dengan kalimat sedang yang mengalir -- JANGAN semua kalimat panjangnya seragam, itu salah satu ciri paling kentara skrip AI yang kaku.`;
}

// Rules 7, 8, 9 and 12 below used to live as inline text inside masterPrompt.ts's
// numbered list, so sceneRegen.ts and hookVariants.ts never got them. That meant
// a regenerated scene was written under a materially different rule set than its
// neighbours -- then placed beside them under a "must look identical across
// scenes" contract. Extracted here so all three builders share one source.

export function buildBannedClaimsRule(): string {
  // Note the wording avoids using the banned words as its own descriptors --
  // the previous version banned "sempurna" in one rule and used it in the next.
  return `JANGAN gunakan kata "sempurna", "flawless", "studio quality", "dijamin", "terbukti ampuh 100%", atau klaim absolut sejenis -- hindari janji berlebihan dan bahasa yang terdengar dibuat mesin.`;
}

export function buildRealismRule(): string {
  return `Instruksi kamera dan pencahayaan harus terasa seperti rekaman HP asli: framing sedikit tidak simetris, pencahayaan ruangan natural (bukan studio lighting), dan ada satu detail kecil yang tidak rapi supaya tidak terlihat seperti render AI.`;
}

export function buildDurationMarkerRule(aspectRatio: string): string {
  return `Tutup "ai_ready_prompt" dengan penanda durasi "[Xs, ${aspectRatio} frame]" (ganti X dengan durasi scene itu dalam detik).`;
}

export function buildWordCountSelfCheckRule(): string {
  return `Hitung sendiri jumlah kata "script_narration" tiap scene dan isi ke "script_word_count" -- pastikan akurat, jangan asal tebak.`;
}

// The char budget was previously mentioned in three uncoordinated places with
// no arithmetic and no priority order, while the mandatory contents of
// ai_ready_prompt exceed the limit outright on the tighter tools (Pika 250,
// Runway/Luma 300). Without a stated priority the model drops whichever part it
// likes -- often the character anchor, which is the one thing that must never
// vary between scenes.
export function buildPromptBudgetRule(aiTool: AiToolId, hasCharacter: boolean): string {
  const { charLimit, label } = getAiToolSpec(aiTool);
  const anchorNote = hasCharacter
    ? "anchor karakter (frasa identik antar scene)"
    : "format faceless yang dipilih (tangan/flat-lay)";
  return `BATAS KARAKTER "ai_ready_prompt": maksimal ${charLimit} karakter untuk ${label}. Ini batas KERAS -- hitung sendiri dan pastikan tidak lewat.
Kalau ruang tidak cukup, potong mengikuti urutan prioritas ini dari yang PALING BOLEH dibuang ke yang TIDAK BOLEH dibuang:
1. Kata sifat mood/gaya (dibuang duluan)
2. Detail lingkungan/latar
3. Detail pencahayaan
4. Detail gerakan kamera
5. Deskripsi aksi
6. ${anchorNote} dan identitas produk -- DUA INI TIDAK BOLEH DIBUANG dalam kondisi apapun; kalau harus, persingkat bagian lain sampai habis dulu.`;
}
