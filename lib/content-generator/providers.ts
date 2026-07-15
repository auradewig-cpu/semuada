import { get } from "@vercel/blob";
import type { AiProvider } from "./types";

export interface ProviderKeys {
  geminiApiKey: string | null;
  geminiModel: string | null;
  groqApiKey: string | null;
  openrouterApiKey: string | null;
  deepseekApiKey: string | null;
}

export interface ImageInput {
  url: string;
  mimeType: string;
}

interface CallResult {
  text: string;
}

const TIMEOUT_MS = 60_000;

function isPrivateBlobUrl(url: string): boolean {
  return url.includes(".private.blob.vercel-storage.com/");
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  // Character photos live in a private Blob store and require SDK-level
  // auth to read; product photos are plain external URLs and use a normal
  // fetch.
  if (isPrivateBlobUrl(url)) {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Gagal mengambil gambar referensi karakter: ${url}`);
    }
    const buffer = await new Response(result.stream).arrayBuffer();
    return { base64: Buffer.from(buffer).toString("base64"), mimeType: result.blob.contentType };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal mengambil gambar referensi: ${url}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();
  return { base64: Buffer.from(buffer).toString("base64"), mimeType: contentType };
}

async function callGemini(apiKey: string, model: string, prompt: string, images: ImageInput[]): Promise<CallResult> {
  const imageParts = await Promise.all(
    images.map(async (img) => {
      const { base64, mimeType } = await fetchImageAsBase64(img.url);
      return { inline_data: { mime_type: mimeType, data: base64 } };
    })
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...imageParts] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 16384, responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(
        `Gemini tidak mengembalikan teks (finishReason: ${candidate?.finishReason ?? "unknown"}).`
      );
    }
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini terpotong karena kehabisan token (MAX_TOKENS) -- coba kurangi jumlah scene.");
    }
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<CallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Provider error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("Provider tidak mengembalikan teks.");
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}

async function callProvider(
  provider: AiProvider,
  keys: ProviderKeys,
  prompt: string,
  images: ImageInput[]
): Promise<CallResult> {
  switch (provider) {
    case "gemini":
      if (!keys.geminiApiKey) throw new Error("Gemini API key belum diisi.");
      return callGemini(keys.geminiApiKey, keys.geminiModel || "gemini-flash-latest", prompt, images);
    case "groq":
      if (!keys.groqApiKey) throw new Error("Groq API key belum diisi.");
      return callOpenAiCompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        keys.groqApiKey,
        "llama-3.3-70b-versatile",
        prompt
      );
    case "openrouter":
      if (!keys.openrouterApiKey) throw new Error("OpenRouter API key belum diisi.");
      return callOpenAiCompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        keys.openrouterApiKey,
        "deepseek/deepseek-chat",
        prompt
      );
    case "deepseek":
      if (!keys.deepseekApiKey) throw new Error("DeepSeek API key belum diisi.");
      return callOpenAiCompatible(
        "https://api.deepseek.com/chat/completions",
        keys.deepseekApiKey,
        "deepseek-chat",
        prompt
      );
  }
}

export async function generateWithFallback(
  providerOrder: AiProvider[],
  keys: ProviderKeys,
  prompt: string,
  images: ImageInput[]
): Promise<{ text: string; providerUsed: AiProvider }> {
  const errors: string[] = [];

  for (const provider of providerOrder) {
    try {
      const result = await callProvider(provider, keys, prompt, images);
      return { text: result.text, providerUsed: provider };
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Semua provider gagal:\n${errors.join("\n")}`);
}
