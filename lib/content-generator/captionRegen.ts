import { buildAvoidRepetitionBlock, type RecentGeneration } from "./variationContext";
import { getLanguageTone } from "./languageTones";
import type { ContentGoal, LanguageTone } from "./types";

export interface CaptionCandidate {
  caption: string;
  hashtags: string[];
}

// Exactly 5 unique hashtags, and the caption itself must carry none -- the same
// contract validateOutput() enforces on the main generate path (see
// jsonParser.ts). Restated here because this prompt does not go through the
// master prompt, so nothing else would hold the line.
export const REQUIRED_HASHTAG_COUNT = 5;

// Word overlap above this counts as "the same caption reworded". Deliberately
// not 1.0: an exact-match-only rule is trivially satisfied by adding an
// exclamation mark or swapping one synonym, which is exactly the evasion the
// user asked to prevent. 0.7 leaves room for a genuinely different sentence
// about the same product to share connective words.
const CAPTION_OVERLAP_LIMIT = 0.7;

// Sharing this many of five hashtags means the combination was not really
// rebuilt. The master prompt already tells the AI overlap of 1-2 is
// acceptable, so 4 is the first count that contradicts it.
const HASHTAG_OVERLAP_LIMIT = 4;

export function normalizeHashtag(tag: string): string {
  return tag.replace(/^#+/, "").trim().toLowerCase();
}

// Lowercase, strip punctuation, collapse whitespace. Everything the similarity
// check compares runs through this first, so "Keren!!" and "keren" are the same
// string rather than two "different" captions.
export function normalizeCaption(caption: string): string {
  return caption
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(caption: string): Set<string> {
  return new Set(normalizeCaption(caption).split(" ").filter(Boolean));
}

// Jaccard over word sets: shared words / total distinct words. Symmetric, so
// padding a caption with filler can't sneak past by making one side longer.
function captionOverlap(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared++;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

function hashtagOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map(normalizeHashtag));
  return a.map(normalizeHashtag).filter((t) => setB.has(t)).length;
}

export interface SimilarityVerdict {
  tooSimilar: boolean;
  /** Human-readable reason, surfaced to the user when every attempt fails. */
  reason: string | null;
}

// THE enforcement point for "must be different from before".
//
// The prompt asks the AI for variety and buildAvoidRepetitionBlock() lists what
// to avoid, but an instruction is a request, not a guarantee -- the model can
// and does return near-copies. This function is what actually holds the rule,
// so the route must reject on it rather than trusting the prompt.
export function isTooSimilar(candidate: CaptionCandidate, previous: CaptionCandidate[]): SimilarityVerdict {
  for (const prev of previous) {
    if (normalizeCaption(candidate.caption) === normalizeCaption(prev.caption)) {
      return { tooSimilar: true, reason: "Caption sama persis dengan versi sebelumnya." };
    }

    const overlap = captionOverlap(candidate.caption, prev.caption);
    if (overlap > CAPTION_OVERLAP_LIMIT) {
      return {
        tooSimilar: true,
        reason: `Caption terlalu mirip versi sebelumnya (${Math.round(overlap * 100)}% kata sama).`,
      };
    }

    const shared = hashtagOverlap(candidate.hashtags, prev.hashtags);
    if (shared >= HASHTAG_OVERLAP_LIMIT) {
      return {
        tooSimilar: true,
        reason: `Kombinasi hashtag hampir sama (${shared} dari ${candidate.hashtags.length} hashtag berulang).`,
      };
    }
  }
  return { tooSimilar: false, reason: null };
}

function tryParse(raw: string): CaptionCandidate | null {
  try {
    const parsed = JSON.parse(raw);
    const caption = typeof parsed?.caption === "string" ? parsed.caption.trim() : "";
    const hashtags = Array.isArray(parsed?.hashtags)
      ? parsed.hashtags.filter((h: unknown): h is string => typeof h === "string")
      : [];
    if (!caption || hashtags.length === 0) return null;
    return { caption, hashtags };
  } catch {
    return null;
  }
}

// Providers wrap JSON in prose often enough that parseCaptionResponse() already
// carries the same salvage step; mirrored here because that helper returns only
// the caption string and drops the hashtags entirely.
export function parseCaptionAndHashtags(rawText: string): CaptionCandidate | null {
  const direct = tryParse(rawText);
  if (direct) return direct;

  const first = rawText.indexOf("{");
  const last = rawText.lastIndexOf("}");
  if (first !== -1 && last > first) return tryParse(rawText.slice(first, last + 1));

  return null;
}

export interface CaptionContractResult {
  value: CaptionCandidate | null;
  problem: string | null;
}

// Normalises what the AI returned into the shape the rest of the app assumes,
// or explains why it can't. Deduplicates and strips leading '#' rather than
// rejecting outright -- those are cosmetic slips the model makes constantly,
// and a repair here is cheaper than another request against a 20/day quota.
// A wrong hashtag COUNT is not repairable, so that one is rejected.
export function enforceCaptionContract(candidate: CaptionCandidate): CaptionContractResult {
  const seen = new Set<string>();
  const hashtags: string[] = [];
  for (const raw of candidate.hashtags) {
    const tag = normalizeHashtag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    hashtags.push(tag);
  }

  if (hashtags.length !== REQUIRED_HASHTAG_COUNT) {
    return {
      value: null,
      problem: `AI mengembalikan ${hashtags.length} hashtag unik, seharusnya tepat ${REQUIRED_HASHTAG_COUNT}.`,
    };
  }

  // Hashtags inside the caption text would render twice in the UI, which
  // already strips them defensively -- keep the stored value clean instead.
  const caption = candidate.caption.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
  if (!caption) {
    return { value: null, problem: "Caption kosong setelah hashtag dibersihkan dari teksnya." };
  }

  return { value: { caption, hashtags }, problem: null };
}

export interface CaptionRegenInput {
  productName: string;
  category: string;
  /** FAKTA PRODUK line from buildProductFacts() -- the only figures the AI may cite. */
  productFactsLine: string;
  contentGoal: ContentGoal;
  languageTone: LanguageTone;
  /** Caption/hashtags currently on screen, plus this product's recent history. */
  avoid: CaptionCandidate[];
  recentGenerations: RecentGeneration[];
}

// A small prompt asking for a caption and 5 hashtags only -- not the whole
// scene set, which is the point of regenerating just this block.
export function compileCaptionRegenPrompt(input: CaptionRegenInput): string {
  const tone = getLanguageTone(input.languageTone);
  const goalRule =
    input.contentGoal === "conversion"
      ? "Tujuan konten: KONVERSI -- caption boleh mengajak beli secara wajar."
      : input.contentGoal === "growth"
        ? "Tujuan konten: GROWTH AKUN -- NOL bahasa jualan, dorong follow/save/share."
        : "Tujuan konten: ENGAGEMENT -- pancing komentar, ajukan pertanyaan.";

  // Reuses the block the master prompt already uses for per-product history, so
  // both paths phrase "avoid repeating yourself" identically.
  const historyBlock = buildAvoidRepetitionBlock(input.recentGenerations);

  const avoidList = input.avoid
    .map((a, i) => `${i + 1}. Caption: "${a.caption}" | Hashtag: ${a.hashtags.map((h) => `#${h}`).join(" ")}`)
    .join("\n");

  return `Tulis SATU caption baru dan TEPAT ${REQUIRED_HASHTAG_COUNT} hashtag untuk produk berikut.

PRODUK: ${input.productName}
KATEGORI: ${input.category}
${input.productFactsLine || "TIDAK ADA fakta terverifikasi untuk produk ini -- jangan sebut angka apa pun (harga, jumlah terjual, rating, ukuran)."}

${goalRule}
GAYA BAHASA: ${tone.label} -- ${tone.blurb}
${tone.instruction}
${historyBlock}
DILARANG MENGULANG yang berikut ini. Caption baru WAJIB berbeda nyata (bukan sekadar tukar satu kata atau tambah tanda baca), dan kombinasi hashtag WAJIB berbeda -- boleh overlap maksimal 2 hashtag paling relevan, sisanya harus baru:
${avoidList}

ATURAN WAJIB:
- Bahasa Indonesia, singkat, catchy, kekinian.
- Field "caption" HANYA teks caption. JANGAN menaruh hashtag apa pun di dalamnya.
- Tepat ${REQUIRED_HASHTAG_COUNT} hashtag unik, tanpa duplikat, tanpa tanda # ganda.

Balas HANYA JSON valid, tanpa penjelasan apa pun:
{"caption": string, "hashtags": string[]}`;
}
