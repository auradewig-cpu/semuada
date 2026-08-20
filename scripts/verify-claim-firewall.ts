// Product Fact Layer + Claim Firewall verification (Phase 3).
//
//   npx tsx scripts/verify-claim-firewall.ts
//
// Asserts:
//   1. buildProductFacts() does NOT emit empty facts for a product with
//      sales=0 / rating=null / empty price.
//   2. scanClaimFirewall() catches invented stats ("1290000" not in facts,
//      "65W", "tahan 48 jam") but NOT the real verified price & rating.

import { buildProductFacts } from "@root/lib/content-generator/productFacts";
import { scanClaimFirewall } from "@root/lib/content-generator/policyCheck";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : ` -- ${detail}`}`);
  if (!cond) failed = true;
}

// 1. No-facts product must not emit empty/meaningless facts.
const empty = buildProductFacts(
  { productName: "Baut kecil", price: "", sales: 0, rating: null, category: "Otomotif", subcategory: null, toko: null, dikirim_dari: null },
  true
);
check("sales=0 not in verified", !empty.verified.some((v) => v.includes("terjual")));
check("rating null not in verified", !empty.verified.some((v) => v.includes("Rating")));
check("no empty price fact", !empty.verified.some((v) => v.includes("Harga Rp ") && !v.replace("Harga Rp ", "").trim()));

// 2. Real facts: the known numbers must be permitted, invented ones flagged.
const real = buildProductFacts(
  { productName: "Casing HP", price: "129000", sales: 2500, rating: "4.8", category: "Handphone & Aksesoris", subcategory: "Casing", toko: "Gadget Store", dikirim_dari: "KOTA TANGERANG" },
  true
);
check("real price in known", real.knownNumbers.includes("129000"));
check("real sales in known", real.knownNumbers.includes("2500"));
check("real rating in known", real.knownNumbers.includes("4.8"));

const cleanNarration = "Casing ini harganya Rp 129.000, sudah terjual 2500 dan ratingnya 4.8, dikirim dari KOTA TANGERANG.";
const cleanViolations = scanClaimFirewall(cleanNarration, real.knownNumbers);
check("real price/rating NOT flagged (false-positive guard)", cleanViolations.length === 0, JSON.stringify(cleanViolations));

const dirtyNarration = "Baterainya tahan 48 jam dan casnya 65W, harganya cuma 1.290.000 aja.";
const dirtyViolations = scanClaimFirewall(dirtyNarration, real.knownNumbers);
const dirtyMessages = dirtyViolations.map((v) => v.match);
check("'tahan 48 jam' caught", dirtyMessages.some((m) => m.includes("48 jam")), JSON.stringify(dirtyMessages));
check("'65W' caught", dirtyMessages.some((m) => m.includes("65W")), JSON.stringify(dirtyMessages));
check("invented price '1.290.000' caught", dirtyMessages.some((m) => m.includes("1.290")), JSON.stringify(dirtyMessages));

// --- Spoken-number forms -------------------------------------------------
// buildSpokenNumberRule() REQUIRES narration to spell numbers out, so these are
// the shapes that actually reach production. Scanning digits only meant every
// fabricated figure written the way the prompt demands passed untouched, while
// only the forbidden digit form was ever caught.
const spoken = (text: string) => scanClaimFirewall(text, real.knownNumbers).map((v) => v.match);

// 129000 spelled out -- the fixture price above, in the form the prompt demands.
const realPriceSpoken = "Harganya cuma seratus dua puluh sembilan ribu aja.";
check("harga ASLI sebagai kata TIDAK di-flag", spoken(realPriceSpoken).length === 0, JSON.stringify(spoken(realPriceSpoken)));
check(
  "harga KARANGAN sebagai kata tertangkap",
  spoken("Harganya cuma sembilan puluh sembilan ribu aja.").length > 0,
  "tidak tertangkap"
);
check(
  "'tahan empat puluh delapan jam' tertangkap",
  spoken("Ini bisa tahan sampai empat puluh delapan jam.").length > 0,
  "tidak tertangkap"
);
check(
  "pesan pelanggaran memakai frasa asli, bukan digit",
  spoken("Harganya cuma sembilan puluh sembilan ribu aja.").some((m) => m.includes("sembilan")),
  "melaporkan digit, bukan kata yang ada di naskah"
);

// --- False-positive guards ------------------------------------------------
// A decimal is only a rating CLAIM when the sentence frames it as one.
for (const [label, text] of [
  ["durasi pemakaian '2,5 bulan'", "Aku pakai ini 2,5 bulan terakhir."],
  ["umur '3,5 tahun'", "Udah 3,5 tahun aku setia sama ini."],
  ["hitungan biasa", "Cuma 3 langkah doang, 2 kali sehari."],
] as const) {
  check(`FP: ${label} tidak di-flag`, spoken(text).length === 0, JSON.stringify(spoken(text)));
}
check("rating KARANGAN tetap tertangkap", spoken("Ratingnya 4,2 kok dari ribuan ulasan.").length > 0, "tidak tertangkap");

console.log(failed ? "\nVERIFICATION FAILED" : "\nVERIFICATION OK");
process.exit(failed ? 1 : 0);
