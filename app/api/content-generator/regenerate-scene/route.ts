import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileSceneRegenPrompt } from "@root/lib/content-generator/sceneRegen";
import { resolveNarrationWpm } from "@root/lib/content-generator/contentStyles";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseSceneResponse, validateScene, checkToolDurationLimits, buildSceneRepairPrompt } from "@root/lib/content-generator/jsonParser";
import { makeSeed } from "@root/lib/content-generator/exampleBank";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { rephraseSceneViolations } from "@root/lib/content-generator/autoRephrase";
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
    languageTone,
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

  const narrationWpm = resolveNarrationWpm(style, settingsRow.narrationWpm ?? 180, languageTone);

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
    languageTone,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    narrationWpm,
    includePrice,
    narrationMode,
    cameraPattern,
    seed: makeSeed(),
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    { url: productImageUrl, mimeType: "image/jpeg" },
  ];

  // Only the last scene carries the price mandate (mirrors buildPriceRule's
  // isLastScene gate in sceneRegen.ts) -- forcing it on a middle scene while
  // the last scene (shown as context) may already state it would duplicate
  // the price across the video.
  const isLastScene = sceneIndex + 1 === totalScenes;
  const priceRequired = includePrice && isLastScene;

  try {
    const response = await generateWithFallback(providerOrder, keys, prompt, images, 0.65);
    let scene = parseSceneResponse(response.text);
    if (!scene) {
      return NextResponse.json({ error: "AI mengembalikan format scene yang tidak bisa dibaca." }, { status: 502 });
    }

    // Structural repair pass FIRST (mirrors generate/route.ts) -- catches
    // things the AI can actually fix given a pointed correction (missing
    // price, empty narration, wrong duration, etc). Previously this endpoint
    // had no repair loop at all, so e.g. a dropped mandatory price on the
    // last scene shipped completely undetected.
    let problems = validateScene(scene, sceneDuration, aiTool, character?.name ?? null, product.productName, product.category, priceRequired, narrationWpm);
    if (problems.length > 0) {
      const repairPrompt = buildSceneRepairPrompt(scene, problems);
      const repaired = await generateWithFallback(providerOrder, keys, repairPrompt, images, 0.65);
      const repairedScene = parseSceneResponse(repaired.text);
      if (repairedScene) {
        scene = repairedScene;
      }
    }

    // Unlike the main "Generate" flow, this endpoint previously skipped
    // compliance checking entirely -- a regenerated scene could reintroduce
    // a banned claim with zero screening. Mirror generate/route.ts's
    // check-then-rephrase-once behavior here too.
    let policyViolations = checkPolicyCompliance({ scenes: [scene], caption: "", hashtags: [] }, contentGoal);
    if (policyViolations.length > 0) {
      scene = await rephraseSceneViolations(scene, policyViolations, providerOrder, keys);
      policyViolations = checkPolicyCompliance({ scenes: [scene], caption: "", hashtags: [] }, contentGoal);
    }

    // Re-validated on the FINAL scene (after both repair and rephrase), not
    // before -- so warnings shown to the user always describe the scene they
    // actually received, never a stale intermediate one.
    problems = validateScene(scene, sceneDuration, aiTool, character?.name ?? null, product.productName, product.category, priceRequired, narrationWpm);

    scene.scene_number = sceneIndex + 1;
    scene.reference_images = {
      character: character ? toCharacterPhotoProxyUrl(character.photoUrl) : null,
      character_filename: character ? "karakter.jpg" : null,
      product: productImageUrl,
      product_filename: `gambar${sceneIndex + 1}.jpg`,
    };

    const warnings = [
      ...problems,
      ...formatPolicyViolations(policyViolations),
      ...checkToolDurationLimits([sceneDuration], aiTool),
    ];
    return NextResponse.json({ scene, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal regenerate scene." },
      { status: 502 }
    );
  }
}
