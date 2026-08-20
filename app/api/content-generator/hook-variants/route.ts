import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileHookVariantsPrompt } from "@root/lib/content-generator/hookVariants";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseHookVariantsResponse, validateScene } from "@root/lib/content-generator/jsonParser";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import { hookVariantsRequestSchema, formatZodError } from "@root/lib/content-generator/validation";
import { resolveNarrationWpm } from "@root/lib/content-generator/contentStyles";
import { getRecentGenerations, buildAvoidRepetitionBlock } from "@root/lib/content-generator/variationContext";
import { makeSeed } from "@root/lib/content-generator/exampleBank";
import { requiredPromptTokens } from "@root/lib/content-generator/promptFragments";
import { resolveVisualDictionary } from "@root/lib/content-generator/cinematography";
import { buildProductFacts } from "@root/lib/content-generator/productFacts";
import { getCategoryBible } from "@root/lib/content-generator/categoryCreative";
import type { AiProvider, SceneOutput } from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const parsed = hookVariantsRequestSchema.safeParse(await request.json());
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
    currentArchetype,
    contentGoal,
    languageTone,
    sceneDuration,
    productImageUrl,
    includePrice,
    narrationMode,
    cameraPattern,
    narratorVoice,
  } = parsed.data;
  const currentScene = parsed.data.currentScene as unknown as SceneOutput;

  // "auto" should never arrive here (the client locks the concrete chosen
  // values before regenerate/variants), but coerce defensively anyway.
  const effStyle = style === "auto" ? "direct_response" : style;
  const effTone = languageTone === "auto" ? "gaul_kekinian" : languageTone;
  const effCurrentArchetype = currentArchetype === "auto" ? "pov_realism" : currentArchetype;

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

  const narrationWpm = resolveNarrationWpm(effStyle, settingsRow.narrationWpm ?? 180, effTone);
  // Variants are alternate scene 1s for the SAME video, so they get the same
  // anti-repetition history the main generate flow uses -- novelty is the whole
  // point of this endpoint, and it previously had no history at all.
  const avoidRepetitionBlock = buildAvoidRepetitionBlock(await getRecentGenerations(productId));

  // Realism profile defaults to the category bible (same as the main generate
  // flow's fallback) so variants match the video's look.
  const realismProfile = getCategoryBible(product.category, product.subcategory).defaultRealism;

  // Same source of truth compileHookVariantsPrompt uses to declare these
  // mandatory, so instruction and validation can't drift apart.
  const requiredTokens = requiredPromptTokens(aiTool, resolveVisualDictionary(effTone, effStyle), realismProfile);

  const variantCount = 3;
  const productFactsLine = buildProductFacts(
    {
      productName: product.productName,
      price: product.price,
      sales: product.sales,
      rating: product.rating,
      category: product.category,
      subcategory: product.subcategory,
      toko: product.toko,
      dikirim_dari: product.dikirim_dari,
    },
    includePrice
  ).promptLine;

  const prompt = compileHookVariantsPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    productFactsLine,
    realismProfile,
    sceneDuration,
    productImageUrl,
    currentScene,
    currentArchetype: effCurrentArchetype,
    contentGoal,
    languageTone: effTone,
    style: effStyle,
    aiTool,
    platform,
    aspectRatio,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    narrationWpm,
    includePrice,
    narrationMode,
    cameraPattern,
    narratorVoice,
    variantCount,
    seed: makeSeed(),
    avoidRepetitionBlock,
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    { url: productImageUrl, mimeType: "image/jpeg" },
  ];

  try {
    const response = await generateWithFallback(providerOrder, keys, prompt, images, 0.65);
    const result = parseHookVariantsResponse(response.text);
    if (!result) {
      return NextResponse.json({ error: "AI mengembalikan format varian yang tidak bisa dibaca." }, { status: 502 });
    }

    const characterProxyUrl = character ? toCharacterPhotoProxyUrl(character.photoUrl) : null;
    const warnings: string[] = [];
    const usedArchetypes: string[] = [];
    const variants = result.variants.map((scene, i) => {
      // priceRequired=false: scene 1 is the hook, never the price beat --
      // matches buildPriceRule(false, ...) in hookVariants.ts.
      const problems = validateScene(scene, sceneDuration, aiTool, character?.name ?? null, product.productName, product.category, false, requiredTokens, narrationMode);
      warnings.push(...problems.map((p) => `Varian ${i + 1}: ${p}`));

      // Detection only (no auto-rephrase): rephrasing all 3 variants would
      // triple AI cost for a feature whose point is picking just one. The
      // admin sees the warning here, and "Regenerate" on the picked variant
      // does get the full rephrase treatment. contentGoal is now threaded
      // through the request schema, so growth-mode's extra commercial-language
      // rules finally apply here too -- previously hardcoded to "conversion",
      // which meant a growth video's variants were never screened for
      // hard-sell language before "Pakai" installed one.
      const policyViolations = checkPolicyCompliance({ scenes: [scene], caption: "", hashtags: [] }, contentGoal);
      warnings.push(...formatPolicyViolations(policyViolations).map((w) => `Varian ${i + 1}: ${w}`));

      const archetypeUsed = scene.hook_archetype_used ?? null;
      if (!archetypeUsed) {
        warnings.push(`Varian ${i + 1}: tidak melaporkan teknik hook yang dipakai -- tidak bisa diverifikasi bedanya dengan varian lain.`);
      } else {
        if (archetypeUsed === currentArchetype) {
          warnings.push(`Varian ${i + 1}: pakai teknik hook yang sama dengan scene saat ini ("${archetypeUsed}") -- seharusnya berbeda.`);
        }
        if (usedArchetypes.includes(archetypeUsed)) {
          warnings.push(`Varian ${i + 1}: pakai teknik hook yang sama dengan varian lain ("${archetypeUsed}") -- seharusnya semua varian beda teknik.`);
        }
        usedArchetypes.push(archetypeUsed);
      }

      scene.scene_number = 1;
      scene.reference_images = {
        character: characterProxyUrl,
        character_filename: character ? "karakter.jpg" : null,
        product: productImageUrl,
        product_filename: "gambar1.jpg",
      };
      return scene;
    });

    return NextResponse.json({ variants, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate hook variants." },
      { status: 502 }
    );
  }
}
