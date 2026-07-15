import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings, contentGenerations } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileMasterPrompt } from "@root/lib/content-generator/masterPrompt";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseAiResponse, validateOutput, buildRepairPrompt } from "@root/lib/content-generator/jsonParser";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import type {
  AiProvider,
  AiToolId,
  AspectRatio,
  ContentGoal,
  ContentStyleId,
  CtaTypeId,
  GenerationResult,
  HookArchetype,
  PlatformTarget,
} from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

function applyReferenceImages(result: GenerationResult, selectedImageUrls: string[], characterPhotoUrl: string | null) {
  const characterDisplayUrl = characterPhotoUrl ? toCharacterPhotoProxyUrl(characterPhotoUrl) : null;
  result.scenes.forEach((scene, index) => {
    scene.scene_number = index + 1;
    scene.reference_images = {
      character: characterDisplayUrl,
      character_filename: characterPhotoUrl ? "karakter.jpg" : null,
      product: selectedImageUrls[index],
      product_filename: `gambar${index + 1}.jpg`,
    };
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const productId: string | undefined = body.productId;
  const selectedImageUrls: string[] = Array.isArray(body.selectedImageUrls) ? body.selectedImageUrls : [];
  const characterId: string | null = body.characterId || null;
  const style: ContentStyleId = body.style;
  const aiTool: AiToolId = body.aiTool;
  const platform: PlatformTarget = body.platform;
  const aspectRatio: AspectRatio = body.aspectRatio;
  const hookArchetype: HookArchetype = body.hookArchetype;
  const contentGoal: ContentGoal = body.contentGoal;
  const ctaType: CtaTypeId = body.ctaType;
  const sceneDurations: number[] = Array.isArray(body.sceneDurations) ? body.sceneDurations : [];

  if (!productId || selectedImageUrls.length === 0 || !style || !aiTool || !platform || !aspectRatio || !hookArchetype || !contentGoal || !ctaType) {
    return NextResponse.json({ error: "Semua parameter (produk, gambar, gaya, AI tool, platform, rasio, hook, tujuan, CTA) wajib diisi." }, { status: 400 });
  }
  if (sceneDurations.length !== selectedImageUrls.length) {
    return NextResponse.json({ error: "Jumlah durasi scene harus sama dengan jumlah gambar yang dipilih." }, { status: 400 });
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
    return NextResponse.json({ error: "Belum ada API key AI tersimpan. Isi dulu di tab Settings." }, { status: 400 });
  }

  const providerOrder = (settingsRow.providerOrder || ["gemini", "groq", "openrouter", "deepseek"]) as AiProvider[];
  const keys = {
    geminiApiKey: settingsRow.geminiApiKey,
    geminiModel: settingsRow.geminiModel,
    groqApiKey: settingsRow.groqApiKey,
    openrouterApiKey: settingsRow.openrouterApiKey,
    deepseekApiKey: settingsRow.deepseekApiKey,
  };
  const narrationWpm = settingsRow.narrationWpm ?? 180;

  const prompt = compileMasterPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    sceneDurations,
    style,
    aiTool,
    platform,
    aspectRatio,
    hookArchetype,
    contentGoal,
    ctaType,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    narrationWpm,
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    ...selectedImageUrls.map((url) => ({ url, mimeType: "image/jpeg" })),
  ];

  const validationContext = { sceneDurations, aiTool, characterName: character?.name ?? null };

  try {
    const first = await generateWithFallback(providerOrder, keys, prompt, images);
    let result = parseAiResponse(first.text);
    if (!result) {
      return NextResponse.json(
        {
          error: "AI mengembalikan format yang tidak bisa dibaca.",
          raw_preview: first.text.slice(0, 800),
        },
        { status: 502 }
      );
    }

    let problems = validateOutput(result, validationContext);
    if (problems.length > 0) {
      const repairPrompt = buildRepairPrompt(result, problems);
      const repaired = await generateWithFallback(providerOrder, keys, repairPrompt, []);
      const repairedResult = parseAiResponse(repaired.text);
      if (repairedResult) {
        result = repairedResult;
        problems = validateOutput(result, validationContext);
      }
    }

    applyReferenceImages(result, selectedImageUrls, character?.photoUrl ?? null);

    const policyViolations = checkPolicyCompliance(result, contentGoal);
    const warnings = [...problems, ...formatPolicyViolations(policyViolations)];

    await db.insert(contentGenerations).values({
      productId: product.id,
      characterId: character?.id,
      style,
      output: JSON.stringify(result),
    });

    return NextResponse.json({ result, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate konten." },
      { status: 502 }
    );
  }
}
