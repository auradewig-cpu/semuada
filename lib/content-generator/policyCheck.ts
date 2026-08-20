import type { ContentGoal, GenerationResult } from "./types";
import { SPEC_UNIT_PATTERN, normalizeSpokenNumbers } from "./productFacts";

// Ported from ViralFrame Studio's policyCheck.ts -- a regex-based compliance
// linter mirroring the POLICY COMPLIANCE instructions in the master prompt.
// Runs AFTER generation as a safety net independent of what the AI actually
// followed, since prompt instructions alone aren't reliably obeyed.

export interface PolicyViolation {
  sceneNumber: number | null;
  field: string;
  match: string;
  category: string;
  suggestion: string;
}

interface PolicyRule {
  pattern: RegExp;
  category: string;
  suggestion: string;
}

const GROWTH_MODE_RULES: PolicyRule[] = [
  {
    pattern: /\b(beli(?:lah)?|checkout|check ?out|keranjang|link (?:di )?bio|promo|diskon|harga (?:spesial|khusus)|order sekarang|gratis ongkir|cod|flash sale)\b/gi,
    category: "Bahasa komersial (Mode Growth)",
    suggestion: "Mode Growth melarang bahasa jualan -- ganti dengan ajakan follow/save/share atau hapus.",
  },
];

const POLICY_RULES: PolicyRule[] = [
  {
    pattern: /\b(dijamin|jamin(?:an)? 100%|pasti (?:untung|berhasil|sembuh|naik)|100% (?:aman|berhasil|ampuh|original)|terbaik|nomor (?:1|satu)|no\.? ?1|paling (?:murah|ampuh|efektif|bagus))\b/gi,
    category: "Klaim absolut",
    suggestion: 'Ubah jadi observasi netral, mis. "banyak dipilih konsumen" alih-alih "nomor 1".',
  },
  {
    pattern: /\b(menyembuhkan|sembuh total|obat (?:ampuh|mujarab)|terbukti klinis|tanpa efek samping|anti (?:kanker|diabetes)|menghilangkan (?:kerutan|jerawat|lemak) dalam \d+)\b/gi,
    category: "Klaim medis/kesehatan",
    suggestion: 'Ganti dengan bahasa perawatan netral, mis. "diformulasikan untuk merawat kulit".',
  },
  {
    pattern: /\b(instant result|hasil instan|dalam \d+ (?:hari|minggu) (?:langsung|dijamin|pasti)|meningkatkan \w+ (?:hingga|sampai) \d+%)\b/gi,
    category: "Klaim performa tanpa bukti",
    suggestion: "Hapus janji waktu/angka spesifik, deskripsikan manfaat secara umum.",
  },
  {
    pattern: /\b(saya (?:sudah )?pakai dan langsung|aku coba dan langsung|setelah pakai \w+ (?:langsung|jadi))\b/gi,
    category: "Testimonial fiktif",
    suggestion: "Hindari format kesaksian pribadi; gunakan deskripsi fitur produk.",
  },
  {
    pattern: /\b(guaranteed|100% guaranteed|the best|number one|no\.? ?1|cures?|clinically proven|instant results?)\b/gi,
    category: "Klaim absolut (English)",
    suggestion: "Rewrite ke deskripsi netral -- prompt English juga difilter kebijakan Google.",
  },
];

function scanText(text: string | null | undefined, extraRules: PolicyRule[] = []): { match: string; category: string; suggestion: string }[] {
  if (!text) return [];
  const found: { match: string; category: string; suggestion: string }[] = [];
  for (const rule of [...POLICY_RULES, ...extraRules]) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text)) !== null) {
      found.push({ match: m[0], category: rule.category, suggestion: rule.suggestion });
    }
  }
  return found;
}

// Words that make a nearby decimal read as a rating rather than as an ordinary
// quantity ("2,5 bulan", "1,5 tahun"). Without this context requirement every
// small decimal was treated as an unverified rating.
const RATING_CONTEXT_PATTERN = /\b(rating|bintang|ulasan|review|penilaian|dari\s*5|per\s*5)\b/i;

// A small window around a match, so the rating test looks at the phrase the
// number sits in rather than the whole narration.
function contextAround(text: string, index: number, length: number, window = 28): string {
  return text.slice(Math.max(0, index - window), Math.min(text.length, index + length + window));
}

// Claim Firewall -- catches invented statistics/specifications, which are the
// most damaging hallucination for affiliate content (a made-up price/rating is
// a direct lie to the buyer). Only numbers the fact layer actually knows are
// allowed to surface; anything stat/spec-like that isn't in the known set is a
// violation routed into the same rephrase path as every other policy breach.
export function scanClaimFirewall(narration: string | null | undefined, knownNumbers: string[]): PolicyViolation[] {
  if (!narration || knownNumbers.length === 0) return [];
  const violations: PolicyViolation[] = [];

  // The narration the AI is INSTRUCTED to write spells numbers out (see
  // buildSpokenNumberRule), so scan a digit-normalised copy -- digit forms are
  // left untouched by the rewrite, so both spellings are covered by one pass.
  const { text: scanned, replacements } = normalizeSpokenNumbers(narration);
  // Report the phrase the user will actually find in the narration, not the
  // digits we folded it into (an instruction to fix "99000" is useless when the
  // script says "sembilan puluh sembilan ribu").
  const asWritten = (digits: string) => replacements.find((r) => r.digits === digits)?.original ?? digits;

  // Indonesian writes thousands with DOTS ("1.290.000"), which is why the
  // shapes are separated here instead of being lumped into one "has a
  // separator = decimal" test: that read 1.290.000 as the decimal 1.29 and let
  // an invented price through. Alternation order matters -- the grouped form
  // must win before the decimal form gets a chance at its first three digits.
  //   1.290.000 / 1,290,000  -> thousands-grouped integer
  //   4,9 / 2.5              -> decimal (rating-shaped)
  //   386900                 -> plain 5+ digit integer
  const numberPattern = /\b(\d{1,3}(?:[.,]\d{3})+|\d+[.,]\d{1,2}|\d{5,})\b/g;
  numberPattern.lastIndex = 0;
  let nm: RegExpExecArray | null;
  while ((nm = numberPattern.exec(scanned)) !== null) {
    const raw = nm[1];
    const normalized = raw.replace(/[.,]/g, "");
    const isGrouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
    const asDecimal = parseFloat(raw.replace(",", "."));
    // A decimal only counts as a rating CLAIM when the sentence actually frames
    // it as one. Treating every decimal under 10 as a rating flagged ordinary
    // phrasing like "aku pakai ini 2,5 bulan" and burned a rephrase call
    // rewriting a perfectly good line.
    const isRatingClaim =
      !isGrouped &&
      /[.,]/.test(raw) &&
      asDecimal > 0 &&
      asDecimal <= 5 &&
      RATING_CONTEXT_PATTERN.test(contextAround(scanned, nm.index, raw.length));
    // Thousand-grouping is deliberate formatting for a quantity/price, so it
    // counts regardless of magnitude.
    const isStatLike = isGrouped || normalized.length >= 5 || isRatingClaim;
    if (!isStatLike) continue;
    if (knownNumbers.includes(normalized) || (!isGrouped && knownNumbers.includes(asDecimal.toFixed(1)))) continue;
    const shown = asWritten(raw);
    violations.push({
      sceneNumber: null,
      field: "script_narration",
      match: shown,
      category: "Statistik tak terverifikasi",
      suggestion: `Angka "${shown}" tidak ada di data produk -- hapus atau ganti dengan angka dari FAKTA PRODUK saja (jangan mengarang harga/jumlah terjual/rating).`,
    });
  }

  // Specification claims (number + spec unit) not in the known set -- e.g.
  // "65W", "5000mAh". The unit list is deliberately narrow (watt/mAh/volt/ml/
  // gram) so common figures of speech pass untouched.
  SPEC_UNIT_PATTERN.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = SPEC_UNIT_PATTERN.exec(scanned)) !== null) {
    const number = sm[1];
    if (knownNumbers.includes(number) || knownNumbers.includes(number.replace(/[.,]/g, ""))) continue;
    const shown = sm[0].replace(number, asWritten(number)).trim();
    violations.push({
      sceneNumber: null,
      field: "script_narration",
      match: shown,
      category: "Klaim spesifikasi tanpa data",
      suggestion: `Spesifikasi "${shown}" tidak ada di data produk -- jangan menyebut watt/mAh/ukuran/kandungan yang tidak terverifikasi.`,
    });
  }

  // Battery-life claims ("tahan 48 jam") -- "jam" alone is too common to be a
  // spec unit, but "tahan N jam" is a specific endurance assertion that has no
  // data behind it.
  const batteryPattern = /\btahan(?: baterai)?(?: sampai| hingga)? (\d+(?:[.,]\d+)?) ?(?:jam|hari)\b/gi;
  batteryPattern.lastIndex = 0;
  let bm: RegExpExecArray | null;
  while ((bm = batteryPattern.exec(scanned)) !== null) {
    if (knownNumbers.includes(bm[1]) || knownNumbers.includes(bm[1].replace(/[.,]/g, ""))) continue;
    const shown = bm[0].replace(bm[1], asWritten(bm[1])).trim();
    violations.push({
      sceneNumber: null,
      field: "script_narration",
      match: shown,
      category: "Klaim spesifikasi tanpa data",
      suggestion: `Klaim daya tahan "${shown}" tidak ada di data produk -- jangan menyebut durasi pemakaian yang tidak terverifikasi.`,
    });
  }

  return violations;
}

export function checkPolicyCompliance(
  result: GenerationResult,
  contentGoal: ContentGoal = "conversion",
  knownNumbers: string[] = []
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const extraRules = contentGoal === "growth" ? GROWTH_MODE_RULES : [];

  for (const scene of result.scenes) {
    const fields: [string, string | null | undefined][] = [
      ["script_narration", scene.script_narration],
      ["ai_ready_prompt", scene.ai_ready_prompt],
      // Burned into the video regardless of narration -- most short-form
      // viewers watch muted, so a banned claim here ships just as visibly.
      ["text_overlay", scene.text_overlay],
    ];
    for (const [field, text] of fields) {
      for (const hit of scanText(text, extraRules)) {
        violations.push({ sceneNumber: scene.scene_number, field, ...hit });
      }
    }
    // Claim Firewall on the narration (the field a viewer actually hears).
    for (const violation of scanClaimFirewall(scene.script_narration, knownNumbers)) {
      violations.push({ ...violation, sceneNumber: scene.scene_number });
    }
  }

  for (const hit of scanText(result.caption, extraRules)) {
    violations.push({ sceneNumber: null, field: "caption", ...hit });
  }

  return violations;
}

export function formatPolicyViolations(violations: PolicyViolation[]): string[] {
  return violations.map((v) => {
    const loc = v.sceneNumber !== null ? `Scene ${v.sceneNumber} (${v.field})` : v.field;
    return `POLICY [${v.category}] ${loc}: "${v.match}" -- ${v.suggestion}`;
  });
}
