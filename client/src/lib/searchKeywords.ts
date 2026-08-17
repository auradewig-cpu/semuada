// Auto-scroll placeholder keywords shown in SearchBar, keyed by the exact
// category name as stored in products.category (see lib/categories.ts).
// A category with no entry here falls back to GENERIC_SEARCH_KEYWORDS.
//
// Sourced from an audit of the actual product/subcategory data in the DB
// (not guessed from the category name) -- some category names read like
// generic marketplace buckets but the real inventory behind them is quite
// different, e.g. "Elektronik" here is home appliances (rice cooker,
// blender, vacuum) rather than gadgets, and "Hobi & Koleksi" is pet
// supplies rather than toys/collectibles. Re-audit this map if the catalog
// composition shifts.
export const CATEGORY_SEARCH_KEYWORDS: Record<string, string[]> = {
  "Elektronik": [
    "rice cooker mini",
    "blender portable",
    "vacuum cleaner",
    "setrika uap",
    "kipas angin portable",
    "coffee maker",
    "lampu led",
  ],
  // Catalog has only ~1 product right now (a kaftan) -- kept broad so it
  // still reads sensibly as the category grows.
  "Fashion Muslim": [
    "gamis",
    "kaftan",
    "dress muslim",
    "mukena",
    "hijab",
  ],
  "Fotografi": [
    "tripod hp",
    "tripod kamera",
    "ring light",
    "lampu sorot vlog",
    "aksesoris konten kreator",
  ],
  "Handphone & Aksesoris": [
    "powerbank fast charging",
    "smartwatch wanita pria",
    "earphone bluetooth tws",
    "kabel data type c",
    "casing hp",
    "kipas genggam portable",
  ],
  "Hobi & Koleksi": [
    "parfum kucing anjing",
    "shampoo kucing anjing",
    "obat kutu hewan",
    "makanan kucing basah",
    "grooming hewan",
  ],
  "Ibu & Bayi": [
    "popok bayi",
    "detergent bayi",
    "sunscreen bayi",
    "lotion bayi",
    "bantal bayi",
  ],
  "Kesehatan": [
    "suplemen vitamin",
    "kapsul diet herbal",
    "popok dewasa",
    "massage gun",
    "suplemen whitening",
  ],
  "Komputer & Aksesoris": [
    "mouse wireless gaming",
    "keyboard wireless",
    "proyektor mini",
    "kursi gaming",
    "kabel hdmi",
  ],
  // Catalog has only ~2 products right now -- kept broad so it still reads
  // sensibly as the category grows.
  "Makanan & Minuman": [
    "minuman collagen",
    "madu murni",
    "kopi sachet",
    "cemilan",
  ],
  "Olahraga & Outdoor": [
    "sepatu roda",
    "alat camping",
    "dumbbell set",
    "kursi lipat camping",
    "galon air outdoor",
  ],
  "Otomotif": [
    "oli mesin mobil",
    "lampu led motor mobil",
    "sparepart mobil",
    "aksesoris eksterior mobil",
    "charger aki mobil",
  ],
  "Pakaian Pria": [
    "kemeja batik pria",
    "kaos lengan panjang pria",
    "celana pendek pria",
    "jaket pria",
    "celana jeans pria",
  ],
  "Pakaian Wanita": [
    "atasan wanita",
    "kain batik wanita",
    "dress wanita",
    "baju hamil menyusui",
    "celana jeans wanita",
  ],
  "Perawatan & Kecantikan": [
    "serum pencerah wajah",
    "sunscreen wajah",
    "paket skincare",
    "masker wajah",
    "kosmetik bibir",
    "shampoo perawatan rambut",
  ],
  "Perlengkapan Rumah": [
    "rak minimalis",
    "panci set masak",
    "tumbler stainless",
    "bor listrik cordless",
    "perlengkapan kamar mandi",
    "lunch box",
  ],
  // Catalog has only ~1 product right now (shoe deodorizer spray, not
  // actual shoes) -- kept narrow to match what's really there.
  "Sepatu Pria": [
    "semprotan anti bau sepatu",
    "perawatan sepatu pria",
  ],
  // Catalog has only ~1 product right now (a tote bag) -- kept narrow to
  // match what's really there.
  "Tas Pria": [
    "totebag pria",
  ],
  "Tas Wanita": [
    "totebag wanita",
    "koper travel",
    "sarung koper",
    "troli belanja lipat",
  ],
};

// Used on the unfiltered homepage and for any category not in the map above.
export const GENERIC_SEARCH_KEYWORDS: string[] = [
  "skincare",
  "fashion wanita",
  "elektronik & gadget",
  "perlengkapan rumah tangga",
  "aksesoris HP",
  "smartwatch",
  "springbed",
  "meja gaming",
  "kursi gaming",
  "powerbank",
];

export function getSearchKeywords(category?: string): string[] {
  if (category && CATEGORY_SEARCH_KEYWORDS[category]) {
    return CATEGORY_SEARCH_KEYWORDS[category];
  }
  return GENERIC_SEARCH_KEYWORDS;
}
