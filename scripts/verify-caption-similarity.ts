// Caption/hashtag similarity-guard verification.
//
//   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/verify-caption-similarity.ts
//
// Exercises the REAL isTooSimilar()/enforceCaptionContract() -- the functions
// that actually hold the "must differ from before" rule -- with NO AI calls, so
// it costs nothing against the 20/day Gemini quota and can be re-run freely.
//
// The false-positive half matters most. A threshold that is too strict makes
// every regenerate fail and burns three quota calls per click, so real captions
// from the database are checked against each other to prove ordinary
// differences are not mistaken for repetition.

import { desc, isNotNull } from "drizzle-orm";
import { db } from "@root/lib/db";
import { contentGenerations } from "@shared/schema";
import { isTooSimilar, enforceCaptionContract, parseCaptionAndHashtags, type CaptionCandidate } from "@root/lib/content-generator/captionRegen";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n        ${detail}`}`);
  if (!cond) failed = true;
}

const TAGS_A = ["mejalipat", "jualan", "praktis", "portable", "umkm"];
const base: CaptionCandidate = {
  caption: "Meja lipat ini praktis banget buat jualan di mana aja.",
  hashtags: TAGS_A,
};

// --- Must be REJECTED ---------------------------------------------------
console.log("Harus DITOLAK:\n");

check(
  "caption identik",
  isTooSimilar({ ...base }, [base]).tooSimilar
);
check(
  "identik + tanda seru (evasi paling murah)",
  isTooSimilar({ caption: "Meja lipat ini praktis banget buat jualan di mana aja!!!", hashtags: ["a", "b", "c", "d", "e"] }, [base]).tooSimilar
);
check(
  "satu kata ditukar sinonim",
  isTooSimilar({ caption: "Meja lipat ini praktis banget buat dagang di mana aja.", hashtags: ["a", "b", "c", "d", "e"] }, [base]).tooSimilar
);
check(
  "hashtag sama persis walau caption beda",
  isTooSimilar({ caption: "Kalimat yang sepenuhnya lain soal produk berbeda.", hashtags: TAGS_A }, [base]).tooSimilar
);
check(
  "4 dari 5 hashtag berulang",
  isTooSimilar({ caption: "Kalimat yang sepenuhnya lain soal produk berbeda.", hashtags: ["mejalipat", "jualan", "praktis", "portable", "baru"] }, [base]).tooSimilar
);
check(
  "mirip dengan salah satu dari BEBERAPA versi sebelumnya (bukan hanya yang terakhir)",
  isTooSimilar({ caption: "Meja lipat ini praktis banget buat jualan di mana aja.", hashtags: ["x", "y", "z", "w", "v"] }, [
    { caption: "Sesuatu yang benar-benar berbeda sama sekali.", hashtags: ["q", "r", "s", "t", "u"] },
    base,
  ]).tooSimilar,
  "riwayat lebih dari satu tidak ikut diperiksa"
);

// --- Must be ACCEPTED ---------------------------------------------------
console.log("\nHarus LOLOS:\n");

check(
  "kalimat benar-benar berbeda untuk produk yang sama",
  !isTooSimilar({ caption: "Gak nyangka semurah ini tapi kuat nahan beban berat.", hashtags: ["mejakuat", "review", "worthit", "belanja", "hemat"] }, [base]).tooSimilar
);
check(
  "overlap 2 hashtag (diizinkan master prompt)",
  !isTooSimilar({ caption: "Gak nyangka semurah ini tapi kuat nahan beban berat.", hashtags: ["mejalipat", "jualan", "kuat", "murah", "recommended"] }, [base]).tooSimilar
);
check("riwayat kosong selalu lolos", !isTooSimilar(base, []).tooSimilar);

// --- Output contract ----------------------------------------------------
console.log("\nKontrak keluaran:\n");

check(
  "hashtag duplikat + tanda # dibersihkan, bukan ditolak",
  (() => {
    const r = enforceCaptionContract({ caption: "Halo", hashtags: ["#Meja", "meja", "#lipat", "jualan", "praktis", "umkm"] });
    return r.value?.hashtags.join(",") === "meja,lipat,jualan,praktis,umkm";
  })(),
  JSON.stringify(enforceCaptionContract({ caption: "Halo", hashtags: ["#Meja", "meja", "#lipat", "jualan", "praktis", "umkm"] }))
);
check(
  "jumlah hashtag salah ditolak",
  enforceCaptionContract({ caption: "Halo", hashtags: ["a", "b", "c"] }).value === null
);
check(
  "hashtag yang nyempil di teks caption dibuang",
  enforceCaptionContract({ caption: "Meja lipat keren #promo #diskon", hashtags: ["a", "b", "c", "d", "e"] }).value?.caption === "Meja lipat keren"
);
check(
  "JSON terbungkus prosa tetap terbaca",
  parseCaptionAndHashtags('Tentu! Ini hasilnya:\n{"caption":"Halo","hashtags":["a","b","c","d","e"]}\nSemoga membantu.')?.caption === "Halo"
);
check("teks tanpa JSON menghasilkan null", parseCaptionAndHashtags("maaf saya tidak bisa membantu") === null);

// --- False positives against REAL captions ------------------------------
console.log("\nUji false-positive dengan caption asli dari database:\n");

const rows = await db
  .select({ caption: contentGenerations.caption, hashtags: contentGenerations.hashtags, productId: contentGenerations.productId })
  .from(contentGenerations)
  .where(isNotNull(contentGenerations.caption))
  .orderBy(desc(contentGenerations.createdAt))
  .limit(60);

const real = rows.filter((r) => r.caption && (r.hashtags?.length ?? 0) > 0);
let compared = 0;
let flagged = 0;
const examples: string[] = [];

for (let i = 0; i < real.length; i++) {
  for (let j = i + 1; j < real.length; j++) {
    // Only pairs from DIFFERENT products: two captions for the same product
    // being similar is a real finding, not a false positive.
    if (real[i].productId === real[j].productId) continue;
    compared++;
    const verdict = isTooSimilar(
      { caption: real[i].caption!, hashtags: real[i].hashtags! },
      [{ caption: real[j].caption!, hashtags: real[j].hashtags! }]
    );
    if (verdict.tooSimilar) {
      flagged++;
      if (examples.length < 3) {
        examples.push(`  "${real[i].caption!.slice(0, 55)}"\n  vs "${real[j].caption!.slice(0, 55)}"\n  -> ${verdict.reason}`);
      }
    }
  }
}

console.log(`  ${compared} pasang caption produk-berbeda dibandingkan, ${flagged} ditandai mirip.`);
examples.forEach((e) => console.log(e));
// A handful of genuine near-duplicates across products is plausible (the
// generator does repeat itself); a large fraction would mean the threshold is
// wrong and every regenerate would fail.
check(
  "ambang tidak menandai caption produk-berbeda secara berlebihan (<5%)",
  compared === 0 || flagged / compared < 0.05,
  `${flagged}/${compared} = ${((flagged / Math.max(compared, 1)) * 100).toFixed(1)}%`
);

console.log(failed ? "\nADA YANG GAGAL" : "\nSEMUA LULUS");
process.exit(failed ? 1 : 0);
