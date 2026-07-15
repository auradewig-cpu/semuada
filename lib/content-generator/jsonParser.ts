import type { GenerationResult, SceneOutput } from "./types";

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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateOutput(result: GenerationResult, expectedSceneCount: number): string[] {
  const problems: string[] = [];

  if (result.scenes.length !== expectedSceneCount) {
    problems.push(`Jumlah scene harus tepat ${expectedSceneCount}, AI mengembalikan ${result.scenes.length}.`);
  }

  result.scenes.forEach((scene: SceneOutput, index: number) => {
    const actualWordCount = countWords(scene.script_narration || "");
    scene.script_word_count = actualWordCount;

    if (!scene.script_narration || actualWordCount === 0) {
      problems.push(`Scene ${index + 1}: narasi kosong.`);
    }
    if (!scene.ai_ready_prompt) {
      problems.push(`Scene ${index + 1}: ai_ready_prompt kosong.`);
    }
  });

  if (!result.caption || result.caption.trim().length === 0) {
    problems.push("Caption kosong.");
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
