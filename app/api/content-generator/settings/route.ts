import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { aiSettings } from "@shared/schema";
import { toApiAiSettings } from "@root/lib/mappers";
import { requireAuth } from "@root/lib/apiAuth";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID));
  if (row) {
    return NextResponse.json(toApiAiSettings(row));
  }
  return NextResponse.json({
    id: AI_SETTINGS_ID,
    gemini_model: "gemini-flash-latest",
    provider_order: ["gemini", "groq", "openrouter", "deepseek"],
    narration_wpm: 180,
    updated_at: null,
    has_gemini_key: false,
    has_groq_key: false,
    has_openrouter_key: false,
    has_deepseek_key: false,
  });
}

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const [existing] = await db.select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID));

  // A blank field in the form means "leave unchanged" -- keys are never
  // sent back to the browser after saving, so the client can't resubmit
  // one it doesn't have. Only overwrite when a non-empty value is posted.
  const nextValues = {
    id: AI_SETTINGS_ID,
    geminiApiKey: body.gemini_api_key || existing?.geminiApiKey,
    geminiModel: body.gemini_model || existing?.geminiModel || "gemini-flash-latest",
    groqApiKey: body.groq_api_key || existing?.groqApiKey,
    openrouterApiKey: body.openrouter_api_key || existing?.openrouterApiKey,
    deepseekApiKey: body.deepseek_api_key || existing?.deepseekApiKey,
    providerOrder: Array.isArray(body.provider_order) ? body.provider_order : existing?.providerOrder,
    narrationWpm: typeof body.narration_wpm === "number" ? body.narration_wpm : existing?.narrationWpm ?? 180,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(aiSettings)
    .values(nextValues)
    .onConflictDoUpdate({ target: aiSettings.id, set: nextValues })
    .returning();

  return NextResponse.json(toApiAiSettings(row));
}
