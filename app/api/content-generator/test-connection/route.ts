import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { aiSettings } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import type { AiProvider } from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

async function testGemini(apiKey: string, model: string): Promise<void> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 4 } }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function testOpenAiCompatible(endpoint: string, apiKey: string, model: string): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: 4, messages: [{ role: "user", content: "ping" }] }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const provider = body.provider as AiProvider;

  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID));
  if (!row) {
    return NextResponse.json({ ok: false, message: "Belum ada API key tersimpan." }, { status: 400 });
  }

  try {
    switch (provider) {
      case "gemini":
        if (!row.geminiApiKey) throw new Error("Gemini API key belum diisi.");
        await testGemini(row.geminiApiKey, row.geminiModel || "gemini-flash-latest");
        break;
      case "groq":
        if (!row.groqApiKey) throw new Error("Groq API key belum diisi.");
        await testOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", row.groqApiKey, "llama-3.3-70b-versatile");
        break;
      case "openrouter":
        if (!row.openrouterApiKey) throw new Error("OpenRouter API key belum diisi.");
        await testOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", row.openrouterApiKey, "deepseek/deepseek-chat");
        break;
      case "deepseek":
        if (!row.deepseekApiKey) throw new Error("DeepSeek API key belum diisi.");
        await testOpenAiCompatible("https://api.deepseek.com/chat/completions", row.deepseekApiKey, "deepseek-chat");
        break;
      default:
        return NextResponse.json({ ok: false, message: "Provider tidak dikenal." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Koneksi berhasil." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Koneksi gagal." },
      { status: 200 }
    );
  }
}
