import { getAiToolSpec } from "./aiTools";
import type { AiToolId, GenerationResult, SceneOutput } from "./types";

export function parseAiResponse(rawText: string): GenerationResult | null {
  const direct = tryParse(rawText);
  if (direct) return direct;

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  return tryParse(rawText.slice(firstBrace, lastBrace + 1));
}

function tryParse(text: string): GenerationResult | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.scenes) && typeof parsed.caption === "string" && Array.isArray(parsed.hashtags)) {
      return parsed as GenerationResult;
    }
    return null;
  } catch {
    return null;
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Ties the "target kecepatan bicara X kata/menit" prompt instruction to an
// actual check -- previously that instruction was never verified, so pacing
// (rushed or sparse narration) could ship without the repair-loop ever
// noticing. +/-40% tolerance: natural speech rate varies a lot by sentence
// structure/punctuation, a tight band would cause false-positive repairs.
function expectedWordCount(durationSeconds: number, wpm: number): number {
  return Math.round((wpm / 60) * durationSeconds);
}

function wordCountInRange(actual: number, expected: number): boolean {
  return actual >= expected * 0.6 && actual <= expected * 1.4;
}

const STOPWORDS = new Set(["dengan", "untuk", "yang", "dari", "original", "terbaru", "resmi", "official", "store", "premium"]);

// Drift detector: if ai_ready_prompt/visual_description don't share ANY
// significant word with the product name/category, the AI likely wandered
// off into an unrelated scene (the root cause of the "smartwatch -> cookies"
// bug) -- flag it so the repair loop forces a rewrite back on-topic.
function mentionsProduct(text: string, productName: string, category: string): boolean {
  const keywords = `${productName} ${category}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  if (keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.some((k) => lowerText.includes(k));
}

// Prices are rendered as spoken-word numbers per SPOKEN_NUMBER_RULE (e.g.
// "sembilan ratus ribuan"), not raw digits -- so this checks for either a
// literal digit sequence (AI sometimes still writes "99 ribu") or the
// magnitude words that virtually always accompany a spoken-out price.
function mentionsPrice(text: string): boolean {
  if (/\d/.test(text)) return true;
  return /\b(rupiah|ribu|ratus|juta|rp)\b/i.test(text);
}

// Fields the AI is asked to produce that nothing ever checked -- all four are
// displayed to the user (or fed to the video tool) and could arrive empty or
// undefined while validateOutput reported zero problems.
function checkRequiredTextFields(scene: SceneOutput, label: string): string[] {
  const problems: string[] = [];
  if (!scene.visual_description || !scene.visual_description.trim()) {
    problems.push(`${label}: visual_description kosong -- wajib diisi (Bahasa Inggris) karena ini deskripsi visual utama scene.`);
  }
  if (!scene.camera_direction || !scene.camera_direction.trim()) {
    problems.push(`${label}: camera_direction kosong -- wajib diisi dengan shot size dan gerakan kamera yang konkret.`);
  }
  if (!scene.transition_to_next || !scene.transition_to_next.trim()) {
    problems.push(`${label}: transition_to_next kosong -- wajib diisi supaya sambungan antar scene jelas.`);
  }
  if (!scene.speech_pace || !scene.speech_pace.trim()) {
    problems.push(`${label}: speech_pace kosong -- wajib diisi.`);
  }
  return problems;
}

export interface ValidationContext {
  sceneDurations: number[];
  aiTool: AiToolId;
  characterName: string | null;
  productName: string;
  category: string;
  includePrice: boolean;
  narrationWpm: number;
}

// Scene duration exceeding the target tool's real per-clip ceiling. Returned
// SEPARATELY from `problems` on purpose: the AI cannot fix a duration the user
// chose, so feeding this into the repair loop would burn an AI call on every
// generate and change nothing. Warn-only, per the agreed design.
export function checkToolDurationLimits(sceneDurations: number[], aiTool: AiToolId): string[] {
  const spec = getAiToolSpec(aiTool);
  const warnings: string[] = [];
  sceneDurations.forEach((duration, index) => {
    if (duration > spec.maxDurationSeconds) {
      warnings.push(
        `Scene ${index + 1}: durasi ${duration}s melebihi batas klip ${spec.label} (~${spec.maxDurationSeconds}s per generate) -- kemungkinan besar harus dipecah atau digenerate beberapa kali di tool tersebut.`
      );
    }
  });
  return warnings;
}

export function validateOutput(result: GenerationResult, context: ValidationContext): string[] {
  const problems: string[] = [];
  const { sceneDurations, aiTool, characterName, productName, category, includePrice, narrationWpm } = context;
  const charLimit = getAiToolSpec(aiTool).charLimit;

  if (result.scenes.length !== sceneDurations.length) {
    problems.push(`Jumlah scene harus tepat ${sceneDurations.length}, AI mengembalikan ${result.scenes.length}.`);
  }

  result.scenes.forEach((scene: SceneOutput, index: number) => {
    const actualWordCount = countWords(scene.script_narration || "");
    scene.script_word_count = actualWordCount;

    if (!scene.script_narration || actualWordCount === 0) {
      problems.push(`Scene ${index + 1}: narasi kosong.`);
    }
    if (!scene.ai_ready_prompt) {
      problems.push(`Scene ${index + 1}: ai_ready_prompt kosong.`);
    } else if (scene.ai_ready_prompt.length > charLimit) {
      problems.push(`Scene ${index + 1}: ai_ready_prompt ${scene.ai_ready_prompt.length} karakter, melebihi batas ${charLimit} untuk tool ini -- persingkat.`);
    }

    const expectedDuration = sceneDurations[index];
    if (expectedDuration !== undefined && scene.duration_seconds !== expectedDuration) {
      problems.push(`Scene ${index + 1}: duration_seconds harus tepat ${expectedDuration}, AI mengembalikan ${scene.duration_seconds}.`);
    }

    if (index === 0 && scene.script_narration) {
      const hasDigit = /\d/.test(scene.script_narration);
      const isDetailedEnough = actualWordCount >= 5;
      if (!hasDigit && !isDetailedEnough) {
        problems.push(`Scene 1: hook terasa generik (tidak ada angka/detail spesifik) -- perkuat dengan detail konkret.`);
      }
    }

    if (characterName && scene.ai_ready_prompt && !scene.ai_ready_prompt.toLowerCase().includes(characterName.toLowerCase())) {
      problems.push(`Scene ${index + 1}: ai_ready_prompt tidak menyebut nama karakter "${characterName}" -- foto referensi karakter berisiko diabaikan AI video tool.`);
    }

    if (scene.ai_ready_prompt && !mentionsProduct(scene.ai_ready_prompt, productName, category)) {
      problems.push(`Scene ${index + 1}: ai_ready_prompt sepertinya TIDAK tentang produk "${productName}" -- kontennya melenceng, tulis ulang supaya jelas tentang produk ini.`);
    }

    if (!scene.text_overlay || !scene.text_overlay.trim()) {
      problems.push(`Scene ${index + 1}: text_overlay kosong -- wajib diisi supaya pesan tetap tersampaikan ke penonton yang menonton tanpa suara.`);
    } else if (countWords(scene.text_overlay) > 8) {
      problems.push(`Scene ${index + 1}: text_overlay terlalu panjang (${countWords(scene.text_overlay)} kata) -- persingkat jadi maksimal 8 kata supaya pas untuk caption burn-in.`);
    }

    problems.push(...checkRequiredTextFields(scene, `Scene ${index + 1}`));

    if (expectedDuration !== undefined && !wordCountInRange(actualWordCount, expectedWordCount(expectedDuration, narrationWpm))) {
      const expected = expectedWordCount(expectedDuration, narrationWpm);
      problems.push(`Scene ${index + 1}: narasi ${actualWordCount} kata untuk durasi ${expectedDuration}s terasa ${actualWordCount < expected ? "terlalu sedikit (buru-buru/kosong)" : "terlalu banyak (kepotong saat diucapkan)"} untuk target ${narrationWpm} kata/menit (idealnya sekitar ${expected} kata) -- sesuaikan panjang narasi.`);
    }
  });

  // Price is allowed to land in any one scene (e.g. near the CTA), not every
  // scene -- so this is checked once across the whole result, not per-scene.
  if (includePrice) {
    const allNarration = result.scenes.map((s) => s.script_narration || "").join(" ");
    if (!mentionsPrice(allNarration)) {
      problems.push(`Fitur "Sertakan harga" aktif tapi TIDAK ADA scene yang menyebutkan harga -- wajib disisipkan di salah satu scene (idealnya dekat hook/CTA).`);
    }
  }

  if (!result.caption || result.caption.trim().length === 0) {
    problems.push("Caption kosong.");
  } else if (/#\w/.test(result.caption)) {
    problems.push('Field "caption" mengandung hashtag di dalam teksnya -- hashtag HARUS hanya di field "hashtags", hapus dari teks caption.');
  }

  // Normalize in place, not just count. Previously the deduped Set was used
  // only for the count check and thrown away, so a list of 7 tags containing 2
  // duplicates passed (size === 5) and all 7 shipped to the user and the DB.
  // The typeof guard matters too: the parser only checks Array.isArray, so a
  // numeric hashtag array used to throw "h.replace is not a function" and
  // surface as a raw JS error in a 502.
  const seen = new Set<string>();
  const normalizedHashtags: string[] = [];
  for (const raw of result.hashtags) {
    if (typeof raw !== "string") continue;
    const cleaned = raw.replace(/^#+/, "").replace(/\s+/g, "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedHashtags.push(cleaned);
  }
  result.hashtags = normalizedHashtags;
  if (normalizedHashtags.length !== 5) {
    problems.push(`Harus tepat 5 hashtag unik dan tidak kosong, ditemukan ${normalizedHashtags.length}.`);
  }

  return problems;
}

export function buildRepairPrompt(result: GenerationResult, problems: string[]): string {
  return `
Output JSON sebelumnya punya masalah berikut:
${problems.map((p) => `- ${p}`).join("\n")}

Ini output sebelumnya:
${JSON.stringify(result)}

Perbaiki HANYA bagian yang bermasalah di atas, pertahankan bagian lain yang sudah benar. Balas HANYA dengan JSON valid berstruktur sama seperti sebelumnya, tanpa teks lain.
`.trim();
}

// Single-scene counterpart of buildRepairPrompt() -- regenerate-scene/route.ts
// works with one SceneOutput object, not the {scenes, caption, hashtags}
// envelope, so the repaired response must stay a single JSON object or
// parseSceneResponse() won't recognize it.
export function buildSceneRepairPrompt(scene: SceneOutput, problems: string[]): string {
  return `
Output JSON scene sebelumnya punya masalah berikut:
${problems.map((p) => `- ${p}`).join("\n")}

Ini output sebelumnya:
${JSON.stringify(scene)}

Perbaiki HANYA bagian yang bermasalah di atas, pertahankan bagian lain yang sudah benar. Balas HANYA dengan SATU objek JSON scene (bukan array, bukan dibungkus objek lain), struktur sama seperti sebelumnya, tanpa teks lain.
`.trim();
}

function trySceneParse(text: string): SceneOutput | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.scene_number === "number" && typeof parsed.script_narration === "string") {
      return parsed as SceneOutput;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseSceneResponse(rawText: string): SceneOutput | null {
  const direct = trySceneParse(rawText);
  if (direct) return direct;

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  return trySceneParse(rawText.slice(firstBrace, lastBrace + 1));
}

export function validateScene(
  scene: SceneOutput,
  expectedDuration: number,
  aiTool: AiToolId,
  characterName: string | null,
  productName: string,
  category: string,
  // True only when this specific scene is the one carrying the price mandate
  // (regenerate-scene: includePrice && this is the last scene; hook-variants:
  // always false, scene 1 is the hook, not the price beat -- see
  // buildPriceRule() in sceneRegen.ts/hookVariants.ts, which this mirrors).
  priceRequired: boolean,
  // Optional -- hook-variants doesn't resolve a WPM today (variants are
  // short hook fragments, not full-pace scenes), so it's omitted there and
  // this check is simply skipped rather than forcing an artificial value.
  narrationWpm?: number
): string[] {
  const problems: string[] = [];
  const charLimit = getAiToolSpec(aiTool).charLimit;

  if (priceRequired && !mentionsPrice(scene.script_narration || "")) {
    problems.push(`Fitur "Sertakan harga" aktif dan scene ini WAJIB menyebut harga (scene terakhir) -- tapi tidak ada harga di narasinya, wajib disisipkan.`);
  }

  const actualWordCount = countWords(scene.script_narration || "");
  scene.script_word_count = actualWordCount;

  if (narrationWpm !== undefined) {
    const expectedWords = expectedWordCount(expectedDuration, narrationWpm);
    if (!wordCountInRange(actualWordCount, expectedWords)) {
      problems.push(`Narasi ${actualWordCount} kata untuk durasi ${expectedDuration}s terasa ${actualWordCount < expectedWords ? "terlalu sedikit (buru-buru/kosong)" : "terlalu banyak (kepotong saat diucapkan)"} untuk target ${narrationWpm} kata/menit (idealnya sekitar ${expectedWords} kata) -- sesuaikan panjang narasi.`);
    }
  }

  if (!scene.script_narration || actualWordCount === 0) problems.push("Narasi kosong.");
  if (!scene.ai_ready_prompt) {
    problems.push("ai_ready_prompt kosong.");
  } else if (scene.ai_ready_prompt.length > charLimit) {
    problems.push(`ai_ready_prompt ${scene.ai_ready_prompt.length} karakter, melebihi batas ${charLimit} -- persingkat.`);
  }
  if (scene.duration_seconds !== expectedDuration) {
    problems.push(`duration_seconds harus tepat ${expectedDuration}, dapat ${scene.duration_seconds}.`);
  }
  if (characterName && scene.ai_ready_prompt && !scene.ai_ready_prompt.toLowerCase().includes(characterName.toLowerCase())) {
    problems.push(`ai_ready_prompt tidak menyebut nama karakter "${characterName}".`);
  }
  if (scene.ai_ready_prompt && !mentionsProduct(scene.ai_ready_prompt, productName, category)) {
    problems.push(`ai_ready_prompt sepertinya TIDAK tentang produk "${productName}" -- kontennya melenceng.`);
  }
  if (!scene.text_overlay || !scene.text_overlay.trim()) {
    problems.push("text_overlay kosong -- wajib diisi supaya pesan tetap tersampaikan ke penonton yang menonton tanpa suara.");
  } else if (countWords(scene.text_overlay) > 8) {
    problems.push(`text_overlay terlalu panjang (${countWords(scene.text_overlay)} kata) -- persingkat jadi maksimal 8 kata.`);
  }

  problems.push(...checkRequiredTextFields(scene, "Scene"));

  return problems;
}

interface HookVariantsResult {
  variants: SceneOutput[];
}

function tryVariantsParse(text: string): HookVariantsResult | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.variants)) return parsed as HookVariantsResult;
    return null;
  } catch {
    return null;
  }
}

export function parseHookVariantsResponse(rawText: string): HookVariantsResult | null {
  const direct = tryVariantsParse(rawText);
  if (direct) return direct;

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  return tryVariantsParse(rawText.slice(firstBrace, lastBrace + 1));
}

function tryCaptionParse(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed.caption === "string" ? parsed.caption : null;
  } catch {
    return null;
  }
}

// The provider layer forces JSON mode on every call (see providers.ts), so
// even a "reply with plain text" rephrase prompt comes back wrapped as
// {"caption": "..."} -- parse that properly instead of only trimming quote
// characters off raw text, which used to leave the JSON wrapper itself
// stuck in the caption. Plain-text fallback stays for defensiveness only.
export function parseCaptionResponse(rawText: string): string | null {
  const direct = tryCaptionParse(rawText);
  if (direct) return direct;

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = tryCaptionParse(rawText.slice(firstBrace, lastBrace + 1));
    if (extracted) return extracted;
  }

  const trimmed = rawText.trim().replace(/^["']|["']$/g, "");
  return trimmed || null;
}
