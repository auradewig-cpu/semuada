import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileHookVariantsPrompt } from "@root/lib/content-generator/hookVariants";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseHookVariantsResponse, validateScene } from "@root/lib/content-generator/jsonParser";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import type {
  AiProvider,
  AiToolId,
  AspectRatio,
  ContentStyleId,
  HookArchetype,
  PlatformTarget,
  SceneOutput,
} from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const productId: string | undefined = body.productId;
  const characterId: string | null = body.characterId || null;
  const style: ContentStyleId = body.style;
  const aiTool: AiToolId = body.aiTool;
  const platform: PlatformTarget = body.platform;
  const aspectRatio: AspectRatio = body.aspectRatio;
  const currentArchetype: HookArchetype = body.currentArchetype;
  const sceneDuration: number = body.sceneDuration;
  const productImageUrl: string = body.productImageUrl;
  const currentScene: SceneOutput = body.currentScene;

  if (!productId || typeof sceneDuration !== "number" || !productImageUrl || !currentScene) {
    return NextResponse.json({ error: "Parameter hook variants tidak lengkap." }, { status: 400 });
  }

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

  const variantCount = 3;
  const prompt = compileHookVariantsPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    sceneDuration,
    productImageUrl,
    currentScene,
    currentArchetype,
    style,
    aiTool,
    platform,
    aspectRatio,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    variantCount,
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    { url: productImageUrl, mimeType: "image/jpeg" },
  ];

  try {
    const response = await generateWithFallback(providerOrder, keys, prompt, images);
    const result = parseHookVariantsResponse(response.text);
    if (!result) {
      return NextResponse.json({ error: "AI mengembalikan format varian yang tidak bisa dibaca." }, { status: 502 });
    }

    const characterProxyUrl = character ? toCharacterPhotoProxyUrl(character.photoUrl) : null;
    const variants = result.variants.map((scene) => {
      validateScene(scene, sceneDuration, aiTool, character?.name ?? null, product.productName, product.category);
      scene.scene_number = 1;
      scene.reference_images = {
        character: characterProxyUrl,
        character_filename: character ? "karakter.jpg" : null,
        product: productImageUrl,
        product_filename: "gambar1.jpg",
      };
      return scene;
    });

    return NextResponse.json({ variants });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate hook variants." },
      { status: 502 }
    );
  }
}
