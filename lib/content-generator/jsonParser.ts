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

export interface ValidationContext {
  sceneDurations: number[];
  aiTool: AiToolId;
  characterName: string | null;
  productName: string;
  category: string;
}

export function validateOutput(result: GenerationResult, context: ValidationContext): string[] {
  const problems: string[] = [];
  const { sceneDurations, aiTool, characterName, productName, category } = context;
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
  });

  if (!result.caption || result.caption.trim().length === 0) {
    problems.push("Caption kosong.");
  } else if (/#\w/.test(result.caption)) {
    problems.push('Field "caption" mengandung hashtag di dalam teksnya -- hashtag HARUS hanya di field "hashtags", hapus dari teks caption.');
  }

  const uniqueHashtags = new Set(result.hashtags.map((h) => h.replace(/^#+/, "").toLowerCase()));
  if (uniqueHashtags.size !== 5) {
    problems.push(`Harus tepat 5 hashtag unik, ditemukan ${uniqueHashtags.size}.`);
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
  category: string
): string[] {
  const problems: string[] = [];
  const charLimit = getAiToolSpec(aiTool).charLimit;

  const actualWordCount = countWords(scene.script_narration || "");
  scene.script_word_count = actualWordCount;

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
