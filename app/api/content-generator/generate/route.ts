import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, characters, aiSettings, contentGenerations } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { compileMasterPrompt } from "@root/lib/content-generator/masterPrompt";
import { resolveNarrationWpm } from "@root/lib/content-generator/contentStyles";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { parseAiResponse, parseCaptionResponse, validateOutput, buildRepairPrompt, checkToolDurationLimits } from "@root/lib/content-generator/jsonParser";
import { narrationModeWasCoerced, requiredPromptTokens } from "@root/lib/content-generator/promptFragments";
import { resolveVisualDictionary } from "@root/lib/content-generator/cinematography";
import { makeSeed } from "@root/lib/content-generator/exampleBank";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { buildCaptionRephrasePrompt, rephraseSceneViolations } from "@root/lib/content-generator/autoRephrase";
import type { PolicyViolation } from "@root/lib/content-generator/policyCheck";
import { toCharacterPhotoProxyUrl } from "@root/lib/mappers";
import { generateRequestSchema, formatZodError } from "@root/lib/content-generator/validation";
import { getRecentGenerations, buildAvoidRepetitionBlock, getCategoryUsageCounts, getGlobalUsageCounts } from "@root/lib/content-generator/variationContext";
import { getCategoryBible } from "@root/lib/content-generator/categoryCreative";
import { buildProductFacts } from "@root/lib/content-generator/productFacts";
import {
  compileCreativeBriefPrompt,
  parseCreativeBrief,
  validateCreativeBrief,
  resolveAutoChoices,
  type CreativeBrief,
  type CreativeUsage,
  type AutoChoices,
} from "@root/lib/content-generator/creativeDirector";
import { mergeUsageCounts } from "@root/lib/content-generator/rotation";
import type { AiProvider, GenerationResult, ContentStyleId, CtaTypeId, HookArchetype, LanguageTone, MechanismId } from "@root/lib/content-generator/types";

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
    result.scenes[sceneIndex] = await rephraseSceneViolations(result.scenes[sceneIndex], sceneViolations, providerOrder, keys);
  }

  if (captionViolations.length > 0) {
    try {
      const rephrasePrompt = buildCaptionRephrasePrompt(result.caption, captionViolations);
      const response = await generateWithFallback(providerOrder, keys, rephrasePrompt, []);
      const newCaption = parseCaptionResponse(response.text);
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
    languageTone,
    includePrice,
    narrationMode,
    cameraPattern,
    narratorVoice,
    mechanism,
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
  // narrationWpm is resolved AFTER the Creative Director resolves any "auto"
  // style/tone below -- resolveNarrationWpm needs a concrete style.

  // Anti-repetition context, scoped per product -- see variationContext.ts.
  const recentGenerations = await getRecentGenerations(productId);
  const avoidRepetitionBlock = buildAvoidRepetitionBlock(recentGenerations);

  // -------------------------------------------------------------------------
  // Creative Director (Stage A): resolve any "auto" selection to a concrete
  // creative direction. The bible + usage counts are computed once; Stage A
  // picks the mechanism/style/hook/CTA/tone/realism. On ANY failure we fall
  // back to pure rotation so generate never dies because Stage A did.
  const bible = getCategoryBible(product.category, product.subcategory);

  // Product Fact Layer (Phase 3): the only figures the AI may cite. Feeds both
  // Stage A's brief and Stage B's prompt, and its knownNumbers drive the Claim
  // Firewall so invented statistics get caught and rephrased.
  const facts = buildProductFacts(product, includePrice);
  const knownNumbers = facts.knownNumbers;

  const [categoryUsage, globalUsage] = await Promise.all([
    getCategoryUsageCounts(product.category, 20),
    getGlobalUsageCounts(20),
  ]);
  // Merge scopes into one usage map per dimension (category weighs ~1.5x, the
  // lighter global scope fills gaps; per-product history stays in the
  // avoidRepetitionBlock). Seed differs per request so consecutive generates
  // don't land on the same rotation pick.
  const seed = makeSeed();
  const usage: CreativeUsage = {
    styles: mergeUsageCounts([
      { counts: categoryUsage.styles, weight: 1.5 },
      { counts: globalUsage.styles, weight: 1 },
    ]),
    hooks: mergeUsageCounts([
      { counts: categoryUsage.hooks, weight: 1.5 },
      { counts: globalUsage.hooks, weight: 1 },
    ]),
    ctaTypes: mergeUsageCounts([
      { counts: categoryUsage.ctaTypes, weight: 1.5 },
      { counts: globalUsage.ctaTypes, weight: 1 },
    ]),
    tones: mergeUsageCounts([
      { counts: categoryUsage.tones, weight: 1.5 },
      { counts: globalUsage.tones, weight: 1 },
    ]),
    mechanisms: mergeUsageCounts([
      { counts: categoryUsage.mechanisms, weight: 1.5 },
      { counts: globalUsage.mechanisms, weight: 1 },
    ]),
  };

  const styleAuto = style === "auto";
  const hookAuto = hookArchetype === "auto";
  const ctaAuto = ctaType === "auto";
  const toneAuto = languageTone === "auto";
  const mechanismAuto = !mechanism;
  const anyAuto = styleAuto || hookAuto || ctaAuto || toneAuto || mechanismAuto;

  let brief: CreativeBrief | null = null;
  if (anyAuto) {
    try {
      const briefPrompt = compileCreativeBriefPrompt({
        productName: product.productName,
        category: product.category,
        subcategory: product.subcategory,
        facts: facts.promptLine || `Hanya ada nama produk "${product.productName}" -- jangan mengarang fakta apa pun.`,
        bible,
        contentGoal,
        avoidRepetitionBlock,
        sceneDurations: scenes.map((s) => s.duration),
      });
      // Text-only, small JSON -- deliberately no images (the decisions don't
      // need pixel detail, and that is what keeps Stage A cheap).
      const briefRes = await generateWithFallback(providerOrder, keys, briefPrompt, [], 0.5);
      const parsed = parseCreativeBrief(briefRes.text);
      if (parsed) {
        brief = validateCreativeBrief(parsed, bible, contentGoal, seed);
      }
    } catch {
      brief = null; // fall through to rotation
    }
  }

  const auto = resolveAutoChoices(bible, contentGoal, usage, seed);

  const mechanismHasBible = mechanism ? bible.mechanisms.some((m) => m.id === mechanism) : false;
  const resolvedMechanism: MechanismId =
    (brief && bible.mechanisms.some((m) => m.id === brief.mechanism) ? brief.mechanism : null) ??
    (mechanismHasBible ? mechanism! : auto.mechanism);

  const resolvedStyle: ContentStyleId = styleAuto ? (brief ? brief.style : auto.style) : style;
  const resolvedHook: HookArchetype = hookAuto ? (brief ? brief.hook_archetype : auto.hook_archetype) : hookArchetype;
  const resolvedCta: CtaTypeId = ctaAuto ? (brief ? brief.cta_type : auto.cta_type) : ctaType;
  const resolvedTone: LanguageTone = toneAuto ? (brief ? brief.language_tone : auto.language_tone) : languageTone;
  const resolvedRealism = brief ? brief.realism_profile : bible.defaultRealism;
  const environment = brief ? brief.environment : "";
  const reasoning = brief ? brief.reasoning : "";

  const autoSelected = anyAuto;
  const narrationWpm = resolveNarrationWpm(resolvedStyle, settingsRow.narrationWpm ?? 180, resolvedTone);

  const prompt = compileMasterPrompt({
    productName: product.productName,
    category: product.category,
    price: product.price,
    productFactsLine: facts.promptLine,
    scenes,
    style: resolvedStyle,
    aiTool,
    platform,
    aspectRatio,
    hookArchetype: resolvedHook,
    contentGoal,
    ctaType: resolvedCta,
    languageTone: resolvedTone,
    characterName: character?.name ?? null,
    characterDescription: character?.description ?? null,
    narrationWpm,
    includePrice,
    narrationMode,
    cameraPattern,
    narratorVoice,
    avoidRepetitionBlock,
    realismProfile: resolvedRealism,
    seed,
    creativeBrief: brief
      ? {
          mechanism: resolvedMechanism,
          environment,
          reasoning,
          scene_plan: brief.scene_plan,
        }
      : null,
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
    includePrice,
    narrationWpm,
    // Same source of truth the prompt used to declare these mandatory, so the
    // instruction and the check can't drift apart.
    requiredTokens: requiredPromptTokens(aiTool, resolveVisualDictionary(resolvedTone, resolvedStyle), resolvedRealism),
    // EFFECTIVE per-scene mode (scene override, else the request default) --
    // matches how compileMasterPrompt resolves it for perSceneDirection.
    sceneNarrationModes: scenes.map((s) => s.narrationMode ?? narrationMode),
    // Per-scene primary actions fixed by Stage A's brief, so validation can
    // catch a scene that silently swapped to a different dominant action.
    primaryActionPlan: brief ? brief.scene_plan.map((s) => s.primary_action) : undefined,
  };

  try {
    // Higher temperature than the 0.35 default for this initial creative
    // call -- more lexical variety, complementing the avoidRepetitionBlock
    // above. Repair/rephrase calls below stay at the default (need precise
    // instruction-following to fix a specific flagged problem, not creativity).
    const first = await generateWithFallback(providerOrder, keys, prompt, images, 0.65);
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

    let policyViolations = checkPolicyCompliance(result, contentGoal, knownNumbers);
    if (policyViolations.length > 0) {
      await applyTargetedRephrase(result, policyViolations, providerOrder, keys);
      policyViolations = checkPolicyCompliance(result, contentGoal, knownNumbers);
    }

    // Stamp reference image URLs/filenames deterministically last, so it's
    // correct regardless of whether the rephrase step touched that field.
    applyReferenceImages(result, selectedImageUrls, character?.photoUrl ?? null);

    // Advisory warnings kept out of `problems` on purpose -- neither is
    // something the AI can fix, so routing them into the repair loop would
    // burn a call per generate and change nothing.
    const advisoryWarnings = [
      ...checkToolDurationLimits(scenes.map((s) => s.duration), aiTool),
      // buildDialogueRule reinterprets faceless+lipsync as voiceover (there is
      // no mouth to sync). That reinterpretation is correct but must never be
      // silent -- the user picked lipsync explicitly.
      ...(scenes.some((s) => narrationModeWasCoerced(s.narrationMode ?? narrationMode, character !== undefined))
        ? [
            `Tidak ada karakter yang dipilih (mode faceless) tapi ada scene bermode "lipsync" -- tidak ada wajah/mulut untuk lipsync, jadi narasinya diperlakukan sebagai voiceover. Pilih karakter kalau memang ingin lipsync.`,
          ]
        : []),
    ];

    const warnings = [...problems, ...formatPolicyViolations(policyViolations), ...advisoryWarnings];

    // Isolated from the main try/catch on purpose: a transient DB error here
    // must not turn an already-successful generation into a 502 for the user
    // (they'd lose the result they already paid AI-call cost for). Losing
    // this one history row just means the next generation's anti-repetition
    // context is slightly less complete, not a user-facing failure.
    let savedGenerationId: string | null = null;
    try {
      const [inserted] = await db
        .insert(contentGenerations)
        .values({
          productId: product.id,
          characterId: character?.id,
          // RESOLVED values, never the raw request -- with "auto" as the UI
          // default, storing the request value would write the literal string
          // "auto" into these columns. getCategoryUsageCounts() reads exactly
          // these three to compute rotation fatigue, so that would leave every
          // real candidate at count 0 (all weights equal -> fatigue silently
          // does nothing), and Phase 5 could never GROUP BY them.
          style: resolvedStyle,
          output: JSON.stringify(result),
          hookArchetype: resolvedHook,
          contentGoal,
          ctaType: resolvedCta,
          caption: result.caption,
          hashtags: result.hashtags,
          // Fingerprint. mechanism/realism_profile come from the Creative
          // Director; auto_selected records whether the direction came from
          // Stage A/rotation or explicit user picks.
          mechanism: resolvedMechanism,
          languageTone: resolvedTone,
          aiTool,
          platform,
          realismProfile: resolvedRealism,
          sceneCount: scenes.length,
          totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
          autoSelected,
        })
        .returning({ id: contentGenerations.id });
      savedGenerationId = inserted?.id ?? null;
    } catch {
      // best-effort history log, see comment above
    }

    return NextResponse.json({
      result,
      warnings,
      generation_id: savedGenerationId,
      chosen: {
        mechanism: resolvedMechanism,
        style: resolvedStyle,
        hook_archetype: resolvedHook,
        cta_type: resolvedCta,
        language_tone: resolvedTone,
        realism_profile: resolvedRealism,
        environment,
        reasoning,
        auto_selected: autoSelected,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate konten." },
      { status: 502 }
    );
  }
}
