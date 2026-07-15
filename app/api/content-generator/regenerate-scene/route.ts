import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileSceneRegenPrompt } from "@root/lib/content-generator/sceneRegen";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseSceneResponse, validateScene } from "@root/lib/content-generator/jsonParser";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import { regenerateSceneRequestSchema, formatZodError } from "@root/lib/content-generator/validation";
import type { AiProvider, SceneOutput } from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const parsed = regenerateSceneRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const {
    productId,
    characterId,
    style,
    aiTool,
    platform,
    aspectRatio,
    hookArchetype,
    contentGoal,
    ctaType,
    sceneIndex,
    sceneDuration,
    productImageUrl,
    totalScenes,
    includePrice,
    narrationMode,
    cameraPattern,
  } = parsed.data;
  const previousScene = parsed.data.previousScene as SceneOutput | null;
  const nextScene = parsed.data.nextScene as SceneOutput | null;

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

  const character = characterId
    ? (await db.select().from(characters).where(eq(characters.id, characterId)))[0]
    : undefined;

  const [settingsRow] = await db.select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID));
  if (!settingsRow) {
    return NextResponse.json({ error: "Belum ada API key AI tersimpan." }, { status: 400 });
  }

  const providerOrder = (settingsRow.providerOrder || ["gemini", "groq", "openrouter", "deepseek"]) as AiProvider[];
  const keys = {
    geminiApiKey: settingsRow.geminiApiKey,
    geminiModel: settingsRow.geminiModel,
    groqApiKey: settingsRow.groqApiKey,
    openrouterApiKey: settingsRow.openrouterApiKey,
    deepseekApiKey: settingsRow.deepseekApiKey,
  };

  const prompt = compileSceneRegenPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    sceneIndex,
    totalScenes,
    sceneDuration,
    productImageUrl,
    previousScene,
    nextScene,
    style,
    aiTool,
    platform,
    aspectRatio,
    hookArchetype,
    contentGoal,
    ctaType,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    narrationWpm: settingsRow.narrationWpm ?? 180,
    includePrice,
    narrationMode,
    cameraPattern,
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    { url: productImageUrl, mimeType: "image/jpeg" },
  ];

  try {
    const response = await generateWithFallback(providerOrder, keys, prompt, images);
    const scene = parseSceneResponse(response.text);
    if (!scene) {
      return NextResponse.json({ error: "AI mengembalikan format scene yang tidak bisa dibaca." }, { status: 502 });
    }

    const problems = validateScene(scene, sceneDuration, aiTool, character?.name ?? null, product.productName, product.category);

    scene.scene_number = sceneIndex + 1;
    scene.reference_images = {
      character: character ? toCharacterPhotoProxyUrl(character.photoUrl) : null,
      character_filename: character ? "karakter.jpg" : null,
      product: productImageUrl,
      product_filename: `gambar${sceneIndex + 1}.jpg`,
    };

    return NextResponse.json({ scene, warnings: problems });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal regenerate scene." },
      { status: 502 }
    );
  }
}
