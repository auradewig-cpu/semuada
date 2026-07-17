import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings, contentGenerations } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileMasterPrompt } from "@root/lib/content-generator/masterPrompt";
import { resolveNarrationWpm } from "@root/lib/content-generator/contentStyles";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseAiResponse, parseSceneResponse, validateOutput, buildRepairPrompt } from "@root/lib/content-generator/jsonParser";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { buildSceneRephrasePrompt, buildCaptionRephrasePrompt } from "@root/lib/content-generator/autoRephrase";
import type { PolicyViolation } from "@root/lib/content-generator/policyCheck";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import { generateRequestSchema, formatZodError } from "@root/lib/content-generator/validation";
import type { AiProvider, GenerationResult } from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

// Targeted fix for policy violations: rewrite only the flagged scene/caption
// instead of resending the whole result (cheaper, less drift risk than the
// structural repair loop above). Best-effort -- if a rephrase attempt fails
// or doesn't parse, the scene/caption is left as-is and the violation stays
// in the warnings for the user to see.
async function applyTargetedRephrase(
  result: GenerationResult,
  violations: PolicyViolation[],
  providerOrder: AiProvider[],
  keys: Parameters<typeof generateWithFallback>[1]
): Promise<void> {
  const violationsByScene = new Map<number, PolicyViolation[]>();
  const captionViolations: PolicyViolation[] = [];
  for (const v of violations) {
    if (v.sceneNumber === null) {
      captionViolations.push(v);
    } else {
      if (!violationsByScene.has(v.sceneNumber)) violationsByScene.set(v.sceneNumber, []);
      violationsByScene.get(v.sceneNumber)!.push(v);
    }
  }

  for (const [sceneNumber, sceneViolations] of violationsByScene) {
    const sceneIndex = result.scenes.findIndex((s) => s.scene_number === sceneNumber);
    if (sceneIndex === -1) continue;
    try {
      const rephrasePrompt = buildSceneRephrasePrompt(result.scenes[sceneIndex], sceneViolations);
      const response = await generateWithFallback(providerOrder, keys, rephrasePrompt, []);
      const rephrased = parseSceneResponse(response.text);
      if (rephrased) result.scenes[sceneIndex] = rephrased;
    } catch {
      // leave scene as-is, violation stays in warnings
    }
  }

  if (captionViolations.length > 0) {
    try {
      const rephrasePrompt = buildCaptionRephrasePrompt(result.caption, captionViolations);
      const response = await generateWithFallback(providerOrder, keys, rephrasePrompt, []);
      const newCaption = response.text.trim().replace(/^["']|["']$/g, "");
      if (newCaption) result.caption = newCaption;
    } catch {
      // leave caption as-is
    }
  }
}

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

  const parsed = generateRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const {
    productId,
    scenes,
    characterId,
    style,
    aiTool,
    platform,
    aspectRatio,
    hookArchetype,
    contentGoal,
    ctaType,
    includePrice,
    narrationMode,
    cameraPattern,
  } = parsed.data;
  const selectedImageUrls = scenes.map((s) => s.imageUrl);

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
  const narrationWpm = resolveNarrationWpm(style, settingsRow.narrationWpm ?? 180);

  const prompt = compileMasterPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    scenes,
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
    includePrice,
    narrationMode,
    cameraPattern,
  });

  const images = [
    ...(character ? [{ url: character.photoUrl, mimeType: "image/jpeg" }] : []),
    ...selectedImageUrls.map((url) => ({ url, mimeType: "image/jpeg" })),
  ];

  const validationContext = {
    sceneDurations: scenes.map((s) => s.duration),
    aiTool,
    characterName: character?.name ?? null,
    productName: product.productName,
    category: product.category,
  };

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

    // Hard guard: even after the repair pass, the AI can still return the
    // wrong scene count. Proceeding would let applyReferenceImages() index
    // past selectedImageUrls and stamp reference_images.product = undefined
    // on the extra scenes -- fail loudly instead of shipping broken scenes.
    if (result.scenes.length !== selectedImageUrls.length) {
      return NextResponse.json(
        {
          error: `AI mengembalikan ${result.scenes.length} scene, seharusnya tepat ${selectedImageUrls.length} -- gagal walau sudah diminta perbaikan. Coba generate ulang.`,
        },
        { status: 502 }
      );
    }

    let policyViolations = checkPolicyCompliance(result, contentGoal);
    if (policyViolations.length > 0) {
      await applyTargetedRephrase(result, policyViolations, providerOrder, keys);
      policyViolations = checkPolicyCompliance(result, contentGoal);
    }

    // Stamp reference image URLs/filenames deterministically last, so it's
    // correct regardless of whether the rephrase step touched that field.
    applyReferenceImages(result, selectedImageUrls, character?.photoUrl ?? null);

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
