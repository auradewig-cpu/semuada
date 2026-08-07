import { getAiToolSpec, usesLiteralDialogueConvention } from "./aiTools";
import { pickExamples, formatExamples, deriveSeed, NARRATOR_AUDIO_BANK } from "./exampleBank";
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
export function buildDialogueRule(aiTool: AiToolId, narrationMode: NarrationMode, hasCharacter: boolean, seed: number): string {
  const toolSpec = getAiToolSpec(aiTool);

  // Faceless + lipsync can't be honoured literally, so resolve it to the only
  // coherent reading (narration as voiceover) instead of demanding a speaker
  // that the character block just said doesn't exist. The route surfaces a
  // warning so the user knows their selection was reinterpreted.
  const effectiveMode: NarrationMode = !hasCharacter && narrationMode === "lipsync" ? "voiceover" : narrationMode;

  if (effectiveMode === "voiceover") {
    const subject = hasCharacter ? "orang di layar" : "tangan/produk di layar";
    // An earlier version asked the model to "compose your own audio clause"
    // with no concrete anchor -- it reliably skipped this in favor of
    // cinematography.ts's simpler ambience/foley instruction, shipping videos
    // with ZERO narration audio. Rotated concrete templates (not one fixed
    // sentence) fix the reliability problem without reintroducing the
    // verbatim-repetition bug.
    const picked = pickExamples(NARRATOR_AUDIO_BANK, 2, deriveSeed(seed, 6));
    return `MODE NARASI: VOICEOVER (non-sync) -- ${subject} TIDAK bicara, narasi datang dari narator di luar frame. JANGAN sisipkan kutipan ucapan, tag [DIALOGUE: ...], atau frasa "says" ke "ai_ready_prompt".
WAJIB isi audio channel secara POSITIF (larangan saja tidak cukup -- kalau audio dibiarkan ambigu, AI video tool otomatis membuat mulut bergerak bicara): "ai_ready_prompt" WAJIB memuat SATU klausa "Audio: ..." yang menyatakan ada narator berbahasa Indonesia di luar frame menjelaskan produk, dan subjek di layar tidak bicara -- ini WAJIB ADA, bukan opsional, dan tidak boleh digantikan hanya oleh deskripsi suara ambience/foley. Contoh pola (tulis versi kamu sendiri dengan makna sama, JANGAN salin persis, boleh gabungkan dengan detail ambience/foley singkat setelahnya): ${formatExamples(picked)}. Jangan mengutip ulang script_narration di sini (batas ${toolSpec.charLimit} karakter), dan jangan menggambarkan setup mirip wawancara/podcast yang memicu kesan sedang bercakap-cakap.`;
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

export function buildWordCountSelfCheckRule(): string {
  return `Hitung sendiri jumlah kata "script_narration" tiap scene dan isi ke "script_word_count" -- pastikan akurat, jangan asal tebak.`;
}

// The generated prompt is copy-pasted manually into each tool's web UI, not
// sent through an API call -- so charLimit is a readability TARGET, not a hard
// ceiling (confirmed with the user; see aiTools.ts). Kept as a soft target with
// a fallback priority order for the rare case a scene genuinely runs long, but
// the urgency is much lower than when these were the old 250-600 char values.
export function buildPromptBudgetRule(aiTool: AiToolId, hasCharacter: boolean): string {
  const { charLimit, label } = getAiToolSpec(aiTool);
  const anchorNote = hasCharacter
    ? "anchor karakter (frasa identik antar scene)"
    : "format faceless yang dipilih (tangan/flat-lay)";
  return `PANJANG TARGET "ai_ready_prompt" untuk ${label}: sekitar ${charLimit} karakter -- ini target keterbacaan, bukan batas keras (prompt ini ditempel manual ke tool, bukan lewat API). Kalau butuh lebih panjang untuk kejelasan, boleh, tapi jangan bertele-tele tanpa menambah informasi visual baru.
Kalau harus memangkas, urutan prioritas dari yang PALING BOLEH dibuang ke yang TIDAK BOLEH dibuang: (1) kata sifat mood/gaya, (2) detail lingkungan/latar, (3) detail pencahayaan, (4) detail gerakan kamera, (5) deskripsi aksi, (6) ${anchorNote} dan identitas produk -- DUA INI TIDAK BOLEH DIBUANG dalam kondisi apapun.`;
}

// The labeled multi-line format below is what real-world prompts that get good
// results from these tools actually look like -- a single dense paragraph
// (the old approach) reads worse to both the video model and the human
// re-reading it before pasting. The closing "Important:" line is a deliberate
// "state critical constraints twice" technique: buildProductAnchorRule/
// buildCharacterBlock already state product/character identity once earlier in
// the prompt -- this asks the model to restate it, in its own words, at the
// very end of ai_ready_prompt itself (the text that actually reaches the video
// tool), which is where a reference-image tool's attention to constraints
// matters most.
export function buildAiReadyPromptStructureRule(hasCharacter: boolean, aspectRatio: string, genreAnchor: string): string {
  const anchorLabel = hasCharacter ? "anchor karakter" : "format faceless yang dipilih";
  return `STRUKTUR "ai_ready_prompt" (WAJIB): tulis sebagai teks BERLABEL MULTI-BARIS (pakai newline antar baris), BUKAN satu paragraf padat. Format:
Scene: [dimulai dengan ${anchorLabel} persis seperti yang sudah ditentukan, lalu aksi + latar]
Camera: [shot size + gerakan kamera, pakai istilah dari KOSAKATA SINEMATOGRAFI di atas]
Lighting: [kualitas + arah cahaya]
Style: ${genreAnchor}
Duration: [X]s, ${aspectRatio} frame.
Important: [dengan kata-katamu sendiri, tegaskan ulang singkat bahwa produk/karakter harus identik dengan referensi -- jangan ubah bentuk/warna/logo, jangan tambah aksesori yang tidak diminta]
Baris "Audio:" (kalau mode voiceover, lihat instruksi MODE NARASI) masuk di antara Style dan Duration.`;
}
