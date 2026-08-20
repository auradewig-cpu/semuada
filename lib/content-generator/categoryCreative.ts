import type { ContentStyleId, HookArchetype, RealismProfileId } from "./types";

// Category Creative Bible -- the domain knowledge that makes a category's video
// feel made-by-a-human instead of a one-size-fits-all ad template. Pure data +
// resolver, NO DB imports, so it's safe to use from the client too (same
// pattern as lib/scheduler/rotation.ts).
//
// Five categories covering ~87% of products get full bibles; everything else
// falls back to GENERIC_BIBLE, so a small/new category always still generates.

export interface CreativeMechanism {
  /** Stable id, e.g. "battery_emergency", "texture_reveal". */
  id: string;
  label: string;
  /** The mini story-beat arc: trigger -> feeling -> action -> relief. */
  storyBeats: string[];
  /** Video styles that can carry this mechanism. */
  fitsStyles: ContentStyleId[];
  /** Hook archetypes that pair naturally with this mechanism. */
  fitsHooks: HookArchetype[];
}

export interface CategoryCreativeBible {
  // Layer 1 -- why people buy this category.
  audience: {
    who: string;
    buyingMotivation: string;
    painPoints: string[];
  };
  // Layer 2 -- the creative vehicles that make sense for this category.
  mechanisms: CreativeMechanism[];
  // Layer 3 -- natural human-product interaction verbs.
  productInteractions: string[];
  // Layer 4 -- the visual grammar that REPLACES the generic menus in
  // cinematography.ts (kept ~5 shot sizes / 5 moves / 4 lighting to hold the
  // prompt size flat -- only the content becomes category-specific).
  visual: {
    environments: string[];
    shotSizes: string[];
    cameraMoves: string[];
    lighting: string[];
    /** Max camera moves per scene -- pushes back on "AI camera porn". */
    cameraBudget: number;
  };
  // Layer 5 -- what to avoid for this category specifically.
  forbidden: string[];
  defaultRealism: RealismProfileId;
}

export const GENERIC_BIBLE: CategoryCreativeBible = {
  audience: {
    who: "penonton umum yang sedang cari solusi praktis",
    buyingMotivation: "melihat produk langsung dipakai menyelesaikan masalah kecil sehari-hari",
    painPoints: ["ragu produknya asli/berfungsi", "takut salah beli", "bosan melihat iklan yang sama"],
  },
  mechanisms: [
    {
      id: "before_after_demo",
      label: "Sebelum & Sesudah",
      storyBeats: ["kondisi bermasalah", "terapkan produk", "hasil berubah"],
      fitsStyles: ["before_after", "tutorial_howto", "direct_response"],
      fitsHooks: ["specific_outcome", "curiosity_gap", "pov_realism"],
    },
    {
      id: "first_unboxing",
      label: "Unboxing Pertama",
      storyBeats: ["kotak datang", "buka perlahan", "reaksi pertama", "ujicoba cepat"],
      fitsStyles: ["vlog_daily", "storytime", "listicle_countdown"],
      fitsHooks: ["relatable", "curiosity_gap", "emotional"],
    },
    {
      id: "texture_reveal",
      label: "Reveal Tekstur/Detail",
      storyBeats: ["fokus satu detail", "dekatkan kamera", "perlihatkan tekstur"],
      fitsStyles: ["listicle_countdown", "before_after", "direct_response"],
      fitsHooks: ["pov_realism", "specific_outcome", "mistake_warning"],
    },
    {
      id: "day_in_use",
      label: "Dipakai Sehari-hari",
      storyBeats: ["pagi", "pakai produk", "sore", "hasilnya"],
      fitsStyles: ["vlog_daily", "storytime", "series_episodic"],
      fitsHooks: ["relatable", "pov_realism", "emotional"],
    },
  ],
  productInteractions: ["memegang produk", "membuka kemasan", "memperlihatkan produk ke kamera", "memindahkan produk dekat lampu"],
  visual: {
    environments: ["meja rumah", "dapur", "kamar", "teras"],
    shotSizes: [
      "close-up (produk memenuhi frame, tangan memegang)",
      "medium close-up (tangan + produk, jarak lengan)",
      "selfie-style medium shot (subjek memegang kamera sendiri)",
      "over-the-shoulder POV (seperti dilihat mata sendiri)",
      "top-down casual (dari atas meja, apa adanya)",
    ],
    cameraMoves: [
      "handheld with slight natural shake (goyang halus seperti dipegang tangan)",
      "quick reframe / adjust grip (menyesuaikan pegangan)",
      "casual tilt down to the product (menunduk ke produk)",
      "static handheld (diam tapi tetap ada micro-movement)",
      "walk-and-talk handheld (sambil jalan)",
    ],
    lighting: [
      "natural window light (cahaya jendela apa adanya)",
      "ordinary room lighting (lampu kamar/ruangan biasa)",
      "slightly uneven indoor light (agak tidak merata, natural)",
      "bright daylight through a window (siang, dari jendela)",
    ],
    cameraBudget: 1,
  },
  forbidden: ["klaim sembarangan", "bahasa brosur", "peragaan yang tidak wajar"],
  defaultRealism: "creator_ugc",
};

// The 5 categories covering ~87% of products (counts from live data).
const HANDPHONE: CategoryCreativeBible = {
  audience: {
    who: "orang yang sedang menimbang upgrade HP, cari casing/aksesori, atau suka eksperimen gadget",
    buyingMotivation: "ingin tahu produk benar-benar kompatibel & terasa premium sebelum beli",
    painPoints: ["takut casing tidak pas", "ragu proteksi kamera", "baterai cepet abis", "sulit bedain ori vs KW"],
  },
  mechanisms: [
    {
      id: "battery_emergency",
      label: "Darurat Baterai",
      storyBeats: ["HP tinggal 3%", "panik", "colok powerbank/kabel", "lega",
      ],
      fitsStyles: ["storytime", "before_after", "vlog_daily"],
      fitsHooks: ["relatable", "pov_realism", "unpopular_opinion"],
    },
    {
      id: "drop_test_protection",
      label: "Uji Ketahanan",
      storyBeats: ["pegang HP dekat lantai", "bayangkan jatuh", "raih casing", "lega terlindungi"],
      fitsStyles: ["before_after", "direct_response", "tutorial_howto"],
      fitsHooks: ["specific_outcome", "curiosity_gap", "mistake_warning"],
    },
    {
      id: "case_fit_reveal",
      label: "Kecocokan Casing",
      storyBeats: ["buka kemasan", "klip casing ke HP", "cek tombol & kamera pas", "puas rapi"],
      fitsStyles: ["listicle_countdown", "tutorial_howto", "vlog_daily"],
      fitsHooks: ["pov_realism", "specific_outcome", "relatable"],
    },
    {
      id: "spec_humble_brag",
      label: "Nilai Lebih Tanpa Jualan",
      storyBeats: ["pakai HP", "tunjukkan layar/kamera", "bandingkan tenang", "simpulkan"],
      fitsStyles: ["vlog_daily", "storytime", "listicle_countdown"],
      fitsHooks: ["unpopular_opinion", "relatable", "emotional"],
    },
  ],
  productInteractions: ["menyentuh layar", "mengklip casing", "menancap kabel", "memutar HP melihat kilau"],
  visual: {
    environments: ["kamar dengan meja penuh gadget", "kafe", "meja kerja", "tangan di atas kasur"],
    shotSizes: [
      "extreme close-up (detail kamera/layar HP)",
      "close-up (HP memenuhi frame, tangan memegang)",
      "POV over-the-shoulder (seperti mata sendiri melihat layar)",
      "top-down (HP di atas meja, dari atas)",
      "medium close-up (tangan + HP, jarak lengan)",
    ],
    cameraMoves: [
      "slow push in to the screen (mendekat ke layar)",
      "casual tilt to show the camera module",
      "handheld micro-shake (dipegang tangan)",
      "quick grip reframe",
      "static handheld framing",
    ],
    lighting: [
      "room light with screen glow (cahaya layar + lampu kamar)",
      "natural window light",
      "slightly uneven indoor light",
      "dim ambient with a desk lamp",
    ],
    cameraBudget: 1,
  },
  forbidden: ["mengklaim spesifikasi tanpa bukti", "menjejerkan spek mentah", "menyebut merek lain secara negatif"],
  defaultRealism: "creator_ugc",
};

const RUMAH: CategoryCreativeBible = {
  audience: {
    who: "orang yang mengurus rumah tangga, cari solusi praktis di dapur/lantai/storage",
    buyingMotivation: "ingin melihat produk menuntaskan masalah dapur/lantai/kerapian secara nyata",
    painPoints: ["sudah beli banyak tapi tidak berfungsi", "takut sulit dibersihkan", "boros waktu", "takut cepat rusak"],
  },
  mechanisms: [
    {
      id: "stain_vanquished",
      label: "Noda Hilang",
      storyBeats: ["noda membandel", "tuang/oles produk", "gosok", "noda hilang"],
      fitsStyles: ["before_after", "tutorial_howto", "direct_response"],
      fitsHooks: ["specific_outcome", "curiosity_gap", "mistake_warning"],
    },
    {
      id: "drawer_transformation",
      label: "Rapi Seketika",
      storyBeats: ["lemari berantakan", "tata pakai produk", "rapi terlihat", "puas"],
      fitsStyles: ["before_after", "listicle_countdown", "vlog_daily"],
      fitsHooks: ["relatable", "specific_outcome", "curiosity_gap"],
    },
    {
      id: "counter_setup",
      label: "Atur Dapur",
      storyBeats: ["meja dapur penuh", "atur peralatan", "fungsional", "nyaman"],
      fitsStyles: ["tutorial_howto", "listicle_countdown", "vlog_daily"],
      fitsHooks: ["relatable", "pov_realism", "curiosity_gap"],
    },
  ],
  productInteractions: ["mengelap permukaan", "menyusun barang di rak", "membuka tutup wadah", "memindahkan produk di atas meja"],
  visual: {
    environments: ["dapur", "kamar mandi", "ruang keluarga", "lemari/rak"],
    shotSizes: [
      "close-up (tangan + produk di atas permukaan)",
      "top-down (produk di atas meja/lantai)",
      "medium close-up (tangan + produk)",
      "POV dari atas tangan (mata sendiri)",
      "over-the-shoulder (dari belakang)",
    ],
    cameraMoves: [
      "casual tilt down to the surface",
      "handheld micro-shake",
      "slow push in to the stain/spot",
      "static handheld framing",
      "quick reframe",
    ],
    lighting: [
      "bright kitchen light (cahaya dapur terang)",
      "natural window light",
      "slightly uneven indoor light",
      "warm practical light",
    ],
    cameraBudget: 1,
  },
  forbidden: ["klaim pembunuh kuman tanpa bukti", "menjanjikan hasil instan mutlak", "menunjukkan hasil yang tidak mungkin"],
  defaultRealism: "creator_ugc",
};

const KECANTIKAN: CategoryCreativeBible = {
  audience: {
    who: "orang yang peduli perawatan diri dan terbiasa dengan ritual skincare/makeup",
    buyingMotivation: "ingin melihat tekstur, aplikasi, dan hasil di kulit secara jujur",
    painPoints: ["takut iritasi", "ragu bahan/keaslian", "sudah coba banyak tapi zonk", "takut boros produk"],
  },
  mechanisms: [
    {
      id: "texture_swatch",
      label: "Swatch Tekstur",
      storyBeats: ["tuang/oles di tangan", "perlihatkan tekstur", "ratakan", "kesan pertama"],
      fitsStyles: ["listicle_countdown", "tutorial_howto", "before_after"],
      fitsHooks: ["pov_realism", "curiosity_gap", "specific_outcome"],
    },
    {
      id: "morning_ritual",
      label: "Ritual Pagi",
      storyBeats: ["bangun", "urutan skincare", "siap beraktivitas", "kulit segar"],
      fitsStyles: ["vlog_daily", "storytime", "series_episodic"],
      fitsHooks: ["relatable", "pov_realism", "emotional"],
    },
    {
      id: "ingredient_truth",
      label: "Kebenaran Kandungan",
      storyBeats: ["baca label", "jelaskan satu kandungan", "kenapa penting", "simpulan jujur"],
      fitsStyles: ["storytime", "listicle_countdown", "direct_response"],
      fitsHooks: ["unpopular_opinion", "mistake_warning", "specific_outcome"],
    },
  ],
  productInteractions: ["mengoleskan produk ke tangan/wajah", "meratakan dengan ujung jari", "menggosok perlahan", "menunjukkan tekstur di punggung tangan"],
  visual: {
    environments: ["meja rias", "kamar dengan pencahayaan alami", "bathroom vanity", "dekat jendela"],
    shotSizes: [
      "extreme close-up (tekstur produk di tangan)",
      "close-up (aplikasi di wajah/tangan)",
      "medium close-up (tangan + produk)",
      "mirror selfie shot (pantulan cermin)",
      "top-down flat-lay (produk ditata di atas meja)",
    ],
    cameraMoves: [
      "slow push in to the swatch",
      "handheld micro-shake",
      "casual tilt to show texture",
      "static handheld framing",
      "quick grip reframe",
    ],
    lighting: [
      "soft natural window light (cahaya jendela lembut)",
      "bright ring-light style but natural",
      "slightly even soft light",
      "gentle diffused daylight",
    ],
    cameraBudget: 1,
  },
  forbidden: ["klaim menghilangkan jerawat/kerut dalam waktu pasti", "menjanjikan hasil medis", "menyebut dosis/SPF tanpa bukti"],
  defaultRealism: "premium_ugc",
};

const PAKAIAN_WANITA: CategoryCreativeBible = {
  audience: {
    who: "orang yang suka fashion, cari pakaian yang pas badan dan bahan nyaman",
    buyingMotivation: "ingin melihat potongan kain dan pas di badan sebelum membeli",
    painPoints: ["takut ukuran tidak pas", "ragu kualitas bahan", "foto produk beda dari aslinya", "takut gerah"],
  },
  mechanisms: [
    {
      id: "outfit_try_on",
      label: "Coba Pakai",
      storyBeats: ["ambil dari gantungan", "kenakan", "putar badan", "nilai pas/nyaman"],
      fitsStyles: ["vlog_daily", "storytime", "listicle_countdown"],
      fitsHooks: ["pov_realism", "relatable", "curiosity_gap"],
    },
    {
      id: "fabric_feel",
      label: "Raba Bahan",
      storyBeats: ["pegang kain", "tarik/perlihatkan tekstur", "cek jatuhnya", "kesan nyaman"],
      fitsStyles: ["listicle_countdown", "before_after", "direct_response"],
      fitsHooks: ["pov_realism", "specific_outcome", "mistake_warning"],
    },
    {
      id: "style_remix",
      label: "Padu Padan",
      storyBeats: ["satu item", "coba 3 gaya", "tampilkan tiap gaya", "rekomendasi"],
      fitsStyles: ["listicle_countdown", "tutorial_howto", "series_episodic"],
      fitsHooks: ["curiosity_gap", "specific_outcome", "emotional"],
    },
  ],
  productInteractions: ["mengenakan pakaian", "memutar badan", "meraba bahan", "menggantung baju di badan"],
  visual: {
    environments: ["kamar dengan cermin", "pintu lemari", "area rumah dengan cahaya alami", "di depan cermin berdiri"],
    shotSizes: [
      "full body shot (seluruh outfit)",
      "medium shot (dari pinggang ke atas)",
      "close-up (detail jahitan/bahan)",
      "mirror shot (pantulan cermin)",
      "walking POV (jalan memperlihatkan outfit)",
    ],
    cameraMoves: [
      "slow pan following the walk",
      "handheld follow (mengikuti, sedikit goyang)",
      "static full-body framing",
      "quick reframe to the fabric detail",
      "casual tilt up the outfit",
    ],
    lighting: [
      "natural window light",
      "soft indoor daylight",
      "bright even daylight",
      "slightly warm practical light",
    ],
    cameraBudget: 1,
  },
  forbidden: ["mengklaim ukuran pasti tanpa tabel", "menjanjikan bahan tidak gerah secara absolut", "menyebut bahan premium tanpa bukti"],
  defaultRealism: "premium_ugc",
};

const ELEKTRONIK: CategoryCreativeBible = {
  audience: {
    who: "penggemar teknologi dan orang yang butuh perangkat rumah/kantor",
    buyingMotivation: "ingin melihat perangkat berfungsi dan kemudahan setup sebelum beli",
    painPoints: ["takut tidak kompatibel", "takut sulit di-setup", "ragu kualitas suara/gambar", "takut cepat rusak"],
  },
  mechanisms: [
    {
      id: "setup_unboxing",
      label: "Setup & Unboxing",
      storyBeats: ["buka kotak", "tata perangkat", "colok/nyalakan", "berfungsi"],
      fitsStyles: ["tutorial_howto", "vlog_daily", "listicle_countdown"],
      fitsHooks: ["curiosity_gap", "specific_outcome", "pov_realism"],
    },
    {
      id: "sound_visual_check",
      label: "Uji Fungsi",
      storyBeats: ["nyalakan", "tunjukkan suara/gambar", "reaksi", "simpulan"],
      fitsStyles: ["before_after", "direct_response", "storytime"],
      fitsHooks: ["specific_outcome", "curiosity_gap", "relatable"],
    },
    {
      id: "everyday_boost",
      label: "Ringankan Kerja Harian",
      storyBeats: ["tugas berulang", "pakai perangkat", "selesai cepat", "lega"],
      fitsStyles: ["tutorial_howto", "before_after", "vlog_daily"],
      fitsHooks: ["relatable", "specific_outcome", "mistake_warning"],
    },
  ],
  productInteractions: ["menekan tombol", "mencolok kabel", "mengarahkan remote", "mengatur knob/display"],
  visual: {
    environments: ["meja kerja", "ruang tamu dengan TV", "dapur dengan perangkat", "area setup dekat colokan"],
    shotSizes: [
      "close-up (tombol/display perangkat)",
      "medium close-up (tangan mengoperasikan)",
      "over-the-shoulder (dari belakang melihat layar)",
      "top-down (perangkat di atas meja)",
      "wide shot (perangkat + lingkungan pemakaian)",
    ],
    cameraMoves: [
      "slow push in to the display/button",
      "static locked-off framing",
      "casual tilt to show the port/plug",
      "handheld micro-shake",
      "quick reframe to the action",
    ],
    lighting: [
      "room light with device screen glow",
      "bright even indoor light",
      "soft practical light",
      "dim ambient with device glow",
    ],
    cameraBudget: 1,
  },
  forbidden: ["mengklaim watt/voltase/garansi tanpa bukti", "menjanjikan umur pakai pasti", "menyebut spesifikasi yang tidak terlihat"],
  defaultRealism: "premium_ugc",
};

// Subcategory overrides -- deliberately empty until a mechanism genuinely
// differs from its parent category (102 subcategories do NOT each get a bible).
const SUBCATEGORY_OVERRIDES: Record<string, Partial<CategoryCreativeBible>> = {};

const CATEGORY_BIBLES: Record<string, CategoryCreativeBible> = {
  "Handphone & Aksesoris": HANDPHONE,
  "Perlengkapan Rumah": RUMAH,
  "Perawatan & Kecantikan": KECANTIKAN,
  "Pakaian Wanita": PAKAIAN_WANITA,
  Elektronik: ELEKTRONIK,
};

/** Returns the bible for a category, merged with a subcategory override if one
 *  exists, falling back to GENERIC_BIBLE for unknown/small categories. */
export function getCategoryBible(category: string | null | undefined, subcategory?: string | null): CategoryCreativeBible {
  const base = (category && CATEGORY_BIBLES[category]) || GENERIC_BIBLE;
  const override = subcategory && SUBCATEGORY_OVERRIDES[subcategory];
  if (!override) return base;
  return {
    ...base,
    ...override,
    audience: { ...base.audience, ...override.audience },
    visual: { ...base.visual, ...override.visual },
  };
}

export { CATEGORY_BIBLES };
