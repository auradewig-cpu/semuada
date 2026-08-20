// Product Fact Layer -- turns the columns products actually has into a small,
// verifiable fact block, replacing the previous "name + category" anchor that
// left the AI with nothing real to say (which is where hallucination came
// from). Three tiers:
//
//   VERIFIED  -- may be cited verbatim (price, sales, rating, toko, subcategory,
//                dikirim_dari) -- thresholds drop the weak/noisy ones entirely
//                rather than forcing the AI to invent a meaning for 0 sales.
//   DERIVED   -- safe, soft conclusions from what's literally written in the
//                product name (e.g. "500ml", "2 pcs"); still tied to the name.
//   UNKNOWN   -- everything else; must never be asserted (the Claim Firewall in
//                policyCheck.ts enforces this after the fact).

const SALES_THRESHOLD = 100;
const RATING_THRESHOLD = 4.0;

// Units that, when they follow a number, read as a product SPECIFICATION rather
// than a passing figure of speech -- the Claim Firewall leans on these.
export const SPEC_UNIT_PATTERN =
  /\b(\d+(?:[.,]\d+)?)\s*(watt|wat|w\b|mah|ah\b|volt|v\b|ml|liter|l\b|gram|gr\b|kg|spf|dop|pcs|pack)\b/gi;

// ---------------------------------------------------------------------------
// Spoken-number recognition (Indonesian).
//
// This exists because the Claim Firewall was scanning for DIGITS while
// buildSpokenNumberRule() in negativePrompt.ts explicitly REQUIRES narration to
// spell numbers out ("ANGKA DALAM NARASI WAJIB diucapkan dalam bentuk lisan").
// So every fabricated figure written the way the prompt demands -- "sembilan
// puluh sembilan ribu", "empat puluh delapan jam" -- sailed straight through,
// while only the digit form (which the prompt forbids) was ever caught.
//
// Normalising the narration to digits first lets every existing check (stat
// numbers, spec units, battery-life) work unchanged on both forms.

const SPOKEN_DIGITS: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};

// "se-" forms are the same words with an implicit leading "satu".
const SPOKEN_PREFIXED: Record<string, string> = {
  sepuluh: "satu puluh",
  sebelas: "satu belas",
  seratus: "satu ratus",
  seribu: "satu ribu",
  sejuta: "satu juta",
};

const SPOKEN_SCALES = new Set(["ribu", "juta", "miliar", "milyar"]);
const SPOKEN_WORDS = new Set([
  ...Object.keys(SPOKEN_DIGITS),
  ...Object.keys(SPOKEN_PREFIXED),
  "puluh", "belas", "ratus", "ribu", "juta", "miliar", "milyar",
]);

// Folds one run of number-words into its numeric value. Uses a two-level
// accumulator (digit -> current -> total) because "tiga ratus delapan puluh
// enam ribu" must read as (300 + 80 + 6) x 1000, not 308 x 10 x ...
function foldSpokenRun(words: string[]): number {
  let total = 0;
  let current = 0;
  let digit = 0;
  for (const word of words) {
    if (word in SPOKEN_DIGITS) {
      digit = SPOKEN_DIGITS[word];
    } else if (word === "belas") {
      current += 10 + digit;
      digit = 0;
    } else if (word === "puluh") {
      current += digit * 10;
      digit = 0;
    } else if (word === "ratus") {
      current += digit * 100;
      digit = 0;
    } else if (SPOKEN_SCALES.has(word)) {
      const scale = word === "ribu" ? 1_000 : word === "juta" ? 1_000_000 : 1_000_000_000;
      const head = current + digit;
      total += (head === 0 ? 1 : head) * scale;
      current = 0;
      digit = 0;
    }
  }
  return total + current + digit;
}

export interface SpokenNumberReplacement {
  /** The digit string the phrase was folded into, e.g. "99000". */
  digits: string;
  /** The original spoken phrase, e.g. "sembilan puluh sembilan ribu". */
  original: string;
}

/**
 * Rewrites every run of Indonesian number-words in `text` into digits, and
 * reports what was replaced so a violation can be reported back to the user
 * using the words they will actually find in the narration.
 * Digit forms already present are left untouched.
 */
export function normalizeSpokenNumbers(text: string): { text: string; replacements: SpokenNumberReplacement[] } {
  const replacements: SpokenNumberReplacement[] = [];
  // Tokenise while keeping the original spans so the rebuilt string stays
  // faithful to everything that is not a number word.
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  let run: { words: string[]; raw: string[] } | null = null;

  const flush = () => {
    if (!run) return;
    const value = foldSpokenRun(run.words);
    const original = run.raw.join(" ").trim();
    // A run folding to 0 that wasn't literally "nol" means the words never
    // formed a real number -- keep the original text rather than inventing one.
    if (value > 0 || run.words[0] === "nol") {
      const digits = String(value);
      replacements.push({ digits, original });
      out.push(digits);
    } else {
      out.push(original);
    }
    run = null;
  };

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (!run) out.push(token);
      continue;
    }
    const bare = token.toLowerCase().replace(/[^a-z]/g, "");
    if (SPOKEN_WORDS.has(bare)) {
      const expanded = (SPOKEN_PREFIXED[bare] ?? bare).split(" ");
      if (run) {
        run.words.push(...expanded);
        run.raw.push(token);
      } else {
        run = { words: expanded, raw: [token] };
      }
      continue;
    }
    flush();
    out.push(token);
  }
  flush();

  return { text: out.join(" ").replace(/\s+/g, " ").trim(), replacements };
}

// Numbers that appear verbatim in the product name, with their unit, e.g.
// "500ml", "2 pcs", "65W" -- DERIVED facts the AI is allowed to restate.
const NAME_MEASURE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(ml|liter|l|gram|gr|g|kg|watt|w|volt|v|mah|ah|pcs|pack|buah|pasang|meter|m)\b/gi;

export interface ProductFactsInput {
  productName: string;
  price: string | number;
  sales: number | null;
  rating: string | number | null;
  category: string;
  subcategory: string | null;
  toko: string | null;
  dikirim_dari: string | null;
}

export interface ProductFactBlock {
  verified: string[];
  derived: string[];
  /** Numbers the AI is allowed to cite (verified + name-derived units). */
  knownNumbers: string[];
  /** A single prompt line summarizing the facts for the AI to use. */
  promptLine: string;
}

export function buildProductFacts(input: ProductFactsInput, includePrice: boolean): ProductFactBlock {
  const verified: string[] = [];
  const derived: string[] = [];
  const knownNumbers: string[] = [];

  if (includePrice && input.price !== null && String(input.price).trim() !== "") {
    verified.push(`Harga Rp ${input.price}`);
    knownNumbers.push(String(input.price).replace(/[.,]/g, ""));
  }

  if (input.sales !== null && Number(input.sales) >= SALES_THRESHOLD) {
    verified.push(`Sudah terjual ${input.sales}`);
    knownNumbers.push(String(input.sales));
  }

  const rating = input.rating === null || input.rating === undefined || input.rating === "" ? null : Number(input.rating);
  if (rating !== null && rating >= RATING_THRESHOLD) {
    verified.push(`Rating ${rating.toFixed(1)}`);
    knownNumbers.push(rating.toFixed(1));
  }

  if (input.subcategory) verified.push(`Subkategori ${input.subcategory}`);
  if (input.toko) verified.push(`Toko ${input.toko}`);
  if (input.dikirim_dari) verified.push(`Dikirim dari ${input.dikirim_dari}`);

  // DERIVED: only what is literally written in the product name.
  NAME_MEASURE_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_MEASURE_PATTERN.exec(input.productName)) !== null) {
    const token = m[0].trim();
    derived.push(`Dari nama produk tertulis "${token}"`);
    knownNumbers.push(m[1]);
  }

  const promptLine =
    verified.length > 0 || derived.length > 0
      ? `FAKTA PRODUK (hanya ini yang boleh dikutip angka/faktanya -- JANGAN mengarang harga, jumlah terjual, rating, ukuran, atau spesifikasi lain): ${[...verified, ...derived].join("; ")}.`
      : "";

  return { verified, derived, knownNumbers, promptLine };
}
