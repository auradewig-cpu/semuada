import type { CtaTypeId, HookArchetype, LanguageTone } from "./types";

// Central pool of concrete example phrases, plus a seeded picker.
//
// Why this exists: concrete examples are what make generated narration sound
// alive instead of abstractly "casual". But a fixed example handed to the model
// on every call gets copied verbatim -- that is exactly why every generation's
// ai_ready_prompt used to open with the identical narrator sentence, and why
// the same slang showed up in every gaul_kekinian script. The fix is not to
// remove examples (that regresses to stiff output) but to show a small RANDOM
// SUBSET of a much larger pool per request, so no phrase is reinforced enough
// to become the house style.
//
// Picking is seeded rather than Math.random() at each call site so one request
// is reproducible end-to-end (the same seed threads through master prompt,
// scene regen, and hook variants) and so a future debug log can replay it.

// xorshift32 -- tiny, dependency-free, good enough for shuffling prompt copy.
// Not for anything security-sensitive.
function nextRandom(state: number): { value: number; state: number } {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x | 0;
  // >>> 0 maps to unsigned so the ratio lands in [0, 1).
  return { value: (next >>> 0) / 0x100000000, state: next };
}

export function makeSeed(): number {
  // Non-zero is required -- xorshift is stuck at 0 forever.
  return (Date.now() ^ (Math.random() * 0xffffffff)) | 0 || 1;
}

// Returns `n` distinct entries from `pool`, chosen by `seed`. Fewer than `n`
// entries in the pool simply returns the whole pool (shuffled).
export function pickExamples(pool: readonly string[], n: number, seed: number): string[] {
  const items = [...pool];
  let state = seed | 0 || 1;
  // Fisher-Yates, but only as far as we need.
  const take = Math.min(n, items.length);
  for (let i = 0; i < take; i++) {
    const r = nextRandom(state);
    state = r.state;
    const j = i + Math.floor(r.value * (items.length - i));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, take);
}

// Formats a picked subset for embedding in a prompt line.
export function formatExamples(picked: string[]): string {
  return picked.map((p) => `"${p}"`).join(", ");
}

// Derives a distinct sub-seed from a base seed, so two banks drawn in the same
// request don't shuffle identically (a bare `seed` reused across pools of the
// same length would pick the same indices every time).
export function deriveSeed(seed: number, salt: number): number {
  return ((seed | 0) ^ (salt * 0x9e3779b1)) | 0 || 1;
}

// --- Language tone vocabulary -----------------------------------------------
// Each pool is deliberately large so a 4-phrase sample rarely repeats between
// consecutive generations of the same product.

export const TONE_PHRASE_BANK: Record<LanguageTone, readonly string[]> = {
  formal_netral: [
    "sebenarnya cukup membantu",
    "cukup praktis dipakai harian",
    "menurut saya wajar kalau banyak dicari",
    "hasilnya lumayan terasa",
    "cukup sesuai kebutuhan",
    "bisa jadi pilihan",
    "terasa lebih ringkas",
    "cukup memudahkan",
    "bekerja seperti yang diharapkan",
    "layak dipertimbangkan",
    "cukup rapi hasilnya",
    "tidak merepotkan",
    "sesuai dengan yang dijanjikan",
    "praktis untuk sehari-hari",
    "cukup nyaman digunakan",
  ],
  santai_ngobrol: [
    "jadi gini",
    "terus nih",
    "soalnya",
    "abis itu",
    "eh tapi",
    "nah",
    "jujur aja",
    "kebetulan banget",
    "ternyata",
    "yang bikin kaget tuh",
    "awalnya sih",
    "ujung-ujungnya",
    "gak nyangka",
    "lumayan lah ya",
    "kepikiran gak sih",
    "pas banget",
    "gara-gara itu",
    "sekarang malah",
  ],
  gaul_kekinian: [
    "worth it banget",
    "auto checkout",
    "spill dikit",
    "gercep",
    "anti ribet",
    "real talk",
    "gasspol",
    "no debat",
    "cakep sih",
    "gokil",
    "beneran works",
    "gak main-main",
    "seketika",
    "langsung beda",
    "hemat effort",
    "sat set",
    "value-nya dapet",
    "jujurly",
    "gak nyesel",
    "underrated banget",
  ],
  elegan_premium: [
    "terasa berbeda sejak sentuhan pertama",
    "detailnya dipikirkan matang",
    "kesan tenang setiap dipakai",
    "sederhana namun berkelas",
    "terasa dirancang dengan sengaja",
    "halus dan konsisten",
    "tanpa berlebihan",
    "bekerja dalam diam",
    "rapi sampai bagian terkecil",
    "menghadirkan ketenangan",
    "presisi yang terasa",
    "kualitas yang bicara sendiri",
    "elegan tanpa mencolok",
    "nyaman dalam kesederhanaan",
  ],
  heboh_lebay: [
    "PARAH SIH",
    "GILA INI",
    "AUTO KAGET",
    "GAK MASUK AKAL",
    "SUMPAH",
    "NGERI BANGET",
    "PECAH",
    "NGAKAK GUE",
    "BUSET",
    "SERIUSAN INI",
    "GAK NYANGKA",
    "BEUH",
    "EDAN",
    "MELEDAK",
    "WADUH",
  ],
  kocak_receh: [
    "gue tuh orangnya males banget",
    "biasanya gue nyerah di tengah",
    "ternyata gue doang yang ribet",
    "gue baru sadar",
    "malu-maluin sih tapi",
    "dulu gue kira susah",
    "gue sempet salah paham",
    "ini sih kesalahan gue",
    "gue akui gue kalah",
    "nasib orang mager",
    "bukan salah produknya, salah gue",
    "gue kira cuma gue",
    "akhirnya nyerah juga",
    "gue overthinking padahal",
  ],
  sotoy_santai: [
    "jadi gini",
    "nah ini dia",
    "gampangnya gini",
    "intinya sih",
    "kalau dipikir-pikir",
    "logikanya begini",
    "yang sering kelewat tuh",
    "poin pentingnya",
    "bedanya di sini",
    "makanya",
    "kuncinya cuma satu",
    "sebenernya simpel",
    "coba perhatiin",
    "nah kalau ini",
  ],
  curhat_personal: [
    "dulu aku sempat",
    "jujur ya",
    "sebenernya",
    "aku pernah ngerasain",
    "ada masanya aku",
    "aku sempat mikir",
    "waktu itu aku",
    "aku baru berani cerita",
    "capek juga sebenernya",
    "aku hampir nyerah",
    "kalau diinget lagi",
    "aku gak nyangka bakal",
    "butuh waktu buat aku",
    "pelan-pelan aku sadar",
  ],
  sarkas_julid: [
    "ya kali masih betah gitu",
    "katanya sih hemat",
    "lucu ya kebiasaan itu",
    "masih aja percaya",
    "ngaku deh",
    "seolah-olah gak ada cara lain",
    "kebiasaan lama emang susah",
    "ya udah lanjut aja kalau nyaman",
    "sambil nunggu keajaiban ya",
    "iya iya, tetep aja",
    "udah tau tapi tetep",
    "biar keliatan sibuk ya",
  ],
  ibu_bapack_relatable: [
    "Bun, pasti relate deh",
    "namanya juga anak-anak",
    "urusan rumah emang gak ada habisnya",
    "Ayah pasti ngerti",
    "pagi-pagi udah rusuh",
    "waktu buat diri sendiri tuh mahal",
    "sambil ngurus ini itu",
    "biar gak nambah kerjaan",
    "yang penting anak nyaman",
    "Bunda pasti pernah ngalamin",
    "belum lagi urusan dapur",
    "sekali beres, lega banget",
  ],
};

// --- Hook openers ------------------------------------------------------------
// Bracket-free on purpose: the old templates ("Stop beli [kategori] mahal")
// shipped to users with the square brackets intact when copied verbatim.

export const HOOK_OPENER_BANK: Record<HookArchetype, readonly string[]> = {
  unpopular_opinion: [
    "kebanyakan orang salah kaprah soal ini",
    "aku gak setuju sama saran yang sering beredar",
    "mahal belum tentu lebih baik di kategori ini",
    "yang selama ini dianggap wajib ternyata gak perlu",
    "ada satu hal yang jarang berani dibilang orang",
    "berhenti percaya sama patokan lama",
  ],
  pov_realism: [
    "momen pas kamu baru sadar hal kecil ini",
    "pagi-pagi, dan situasinya persis kayak gini",
    "kamu lagi buru-buru, terus kejadian ini muncul",
    "posisi kamu waktu itu pasti sama",
    "detik-detik yang bikin kamu mikir ulang",
  ],
  specific_outcome: [
    "yang berubah bukan kesannya, tapi angkanya",
    "bedanya kelihatan dari hal yang bisa dihitung",
    "hasilnya bisa dibandingin langsung sebelum-sesudah",
    "yang tadinya makan waktu lama, sekarang jauh lebih singkat",
    "selisihnya jelas, bukan sekadar perasaan",
  ],
  curiosity_gap: [
    "ada satu bagian yang sengaja aku simpan di akhir",
    "kebanyakan orang berhenti sebelum tahu bagian ini",
    "yang bikin beda justru bukan yang kamu kira",
    "aku baru ngeh setelah beberapa hari",
    "detail kecilnya baru kelihatan kalau diperhatiin",
  ],
  relatable: [
    "kebiasaan ini pasti kamu lakuin juga",
    "hal sepele yang ternyata ganggu tiap hari",
    "situasi yang berulang terus tiap minggu",
    "yang bikin capek sebenernya bukan kerjaan besarnya",
    "pasti pernah ngalamin yang kayak gini",
  ],
  emotional: [
    "ada rasa lega yang susah dijelasin",
    "sempat frustrasi sampai mau nyerah",
    "yang paling kerasa itu bagian tenangnya",
    "capek yang menumpuk pelan-pelan",
    "akhirnya bisa napas juga",
  ],
  mistake_warning: [
    "jangan buru-buru sebelum tahu bagian ini",
    "kesalahan ini yang bikin masalahnya balik lagi",
    "banyak yang keliru di langkah paling awal",
    "hal kecil ini sering dilewat dan bikin rugi",
    "sebelum kamu ambil keputusan, cek ini dulu",
  ],
};

// --- CTA phrasings -----------------------------------------------------------
// Brand-fixed wordings (Shopee's yellow cart) stay literal on purpose -- those
// are UI element names, not stylistic choices, so rotating them would make the
// instruction wrong. Everything else rotates.

export const CTA_PHRASE_BANK: Partial<Record<CtaTypeId, readonly string[]>> = {
  link_bio: ["cek link di bio", "detailnya ada di bio", "info lengkapnya di bio", "linknya udah aku taruh di bio"],
  dm_whatsapp: ["chat aja langsung", "tanya-tanya lewat WA", "DM kalau mau nanya", "hubungi lewat WhatsApp"],
  comment_keyword: ["tulis di kolom komentar", "komen kata kuncinya", "tinggalin komentar", "ketik di komentar"],
  follow_more: ["follow biar gak ketinggalan", "ikutin buat konten lanjutannya", "follow dulu", "pantengin terus"],
  share_tag_friend: ["kirim ke yang lagi butuh", "tag temen kamu", "share ke grup", "kasih tau yang perlu"],
  visit_website: ["mampir ke tokonya", "cek langsung di website", "kunjungi tokonya", "lihat selengkapnya di toko"],
  limited_urgency: ["sisanya tinggal sedikit", "jangan kelamaan mikir", "keburu abis", "mumpung masih ada"],
  save_for_later: ["simpan dulu videonya", "save biar gampang dicari", "bookmark buat nanti", "simpan buat referensi"],
};

// --- Caption share phrasing (Reels DM-share nudge) ---------------------------

export const CAPTION_SHARE_BANK: readonly string[] = [
  "kirim ke temen yang lagi butuh ini",
  "tag orang yang harus lihat ini",
  "share ke yang lagi nyari",
  "kasih tau temen kamu",
  "simpan dan kirim ke yang perlu",
  "tandain temen yang cocok",
];

// --- Spoken price examples ---------------------------------------------------
// Replaces the old real-estate leftovers ("empat setengah miliar", "dua ratus
// lima puluh lima meter") that were injected into every prompt in the system
// regardless of the actual product price.

export const SPOKEN_PRICE_BANK: readonly string[] = [
  'Rp 89.000 jadi "delapan puluh sembilan ribu"',
  'Rp 125.000 jadi "seratus dua puluh lima ribu"',
  'Rp 49.900 jadi "empat puluh sembilan ribuan"',
  'Rp 250.000 jadi "dua ratus lima puluh ribu"',
  'Rp 1.350.000 jadi "satu juta tiga ratus lima puluh ribu"',
  'Rp 75.000 jadi "tujuh puluh lima ribu"',
];
