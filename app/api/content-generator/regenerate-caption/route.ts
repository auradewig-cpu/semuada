import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products, aiSettings, contentGenerations } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";
import { generateWithFallback } from "@root/lib/content-generator/providers";
import { checkPolicyCompliance, formatPolicyViolations } from "@root/lib/content-generator/policyCheck";
import { buildCaptionRephrasePrompt } from "@root/lib/content-generator/autoRephrase";
import { parseCaptionResponse } from "@root/lib/content-generator/jsonParser";
import { buildProductFacts } from "@root/lib/content-generator/productFacts";
import { getRecentGenerations } from "@root/lib/content-generator/variationContext";
import { regenerateCaptionRequestSchema, formatZodError } from "@root/lib/content-generator/validation";
import {
  compileCaptionRegenPrompt,
  parseCaptionAndHashtags,
  enforceCaptionContract,
  isTooSimilar,
  type CaptionCandidate,
} from "@root/lib/content-generator/captionRegen";
import type { AiProvider } from "@root/lib/content-generator/types";

const AI_SETTINGS_ID = "2c8e5c1a-9f3d-4b7e-8a2c-6d1f4e9b0a3c";

// Capped deliberately. Each attempt is one provider call, and the Gemini free
// tier allows 20 generateContent requests per day PER MODEL -- a runaway retry
// loop here would eat a whole day's budget on one click. Three is enough for
// the model to find a genuinely different angle; beyond that it is usually
// stuck, and the user can decide whether to click again.
const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const parsed = regenerateCaptionRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const { productId, contentGoal, languageTone, includePrice, currentCaption, currentHashtags, contentGenerationId } = parsed.data;

  // "auto" is a UI-level placeholder resolved by the Creative Director at
  // generate time; SceneOutputPanel always passes the resolved tone, so this
  // only guards a malformed request. Same fallback hook-variants/route.ts uses.
  const effTone = languageTone === "auto" ? "gaul_kekinian" : languageTone;

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

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

  const facts = buildProductFacts(
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
  );

  const recentGenerations = await getRecentGenerations(productId);

  // What the new version must differ from: the caption on screen PLUS this
  // product's recent history. History matters -- comparing only against what is
  // displayed lets repeated clicks oscillate A -> B -> A forever.
  const avoid: CaptionCandidate[] = [];
  if (currentCaption.trim()) avoid.push({ caption: currentCaption, hashtags: currentHashtags });
  for (const r of recentGenerations) {
    if (r.caption?.trim()) avoid.push({ caption: r.caption, hashtags: r.hashtags ?? [] });
  }

  try {
    let accepted: CaptionCandidate | null = null;
    let lastCandidate: CaptionCandidate | null = null;
    let lastReason: string | null = null;
    // Grows as attempts are rejected: without feeding the rejected text back in,
    // the next attempt is blind to what just failed and tends to repeat it.
    const avoidThisRun = [...avoid];

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !accepted; attempt++) {
      const prompt = compileCaptionRegenPrompt({
        productName: product.productName,
        category: product.category,
        productFactsLine: facts.promptLine,
        contentGoal,
        languageTone: effTone,
        avoid: avoidThisRun,
        recentGenerations,
      });

      // 0.9, well above the 0.65 used for scene regen: lexical variety is the
      // whole objective here, not faithful instruction-following.
      const response = await generateWithFallback(providerOrder, keys, prompt, [], 0.9);
      const raw = parseCaptionAndHashtags(response.text);
      if (!raw) continue;

      const contract = enforceCaptionContract(raw);
      if (!contract.value) {
        lastReason = contract.problem;
        continue;
      }

      const verdict = isTooSimilar(contract.value, avoid);
      lastCandidate = contract.value;
      if (!verdict.tooSimilar) {
        accepted = contract.value;
      } else {
        lastReason = verdict.reason;
        avoidThisRun.push(contract.value);
      }
    }

    // Every attempt produced something unusable (unparseable or wrong hashtag
    // count) -- there is nothing to show, so this is a real failure.
    if (!accepted && !lastCandidate) {
      return NextResponse.json(
        { error: `AI tidak mengembalikan caption yang bisa dipakai${lastReason ? ` (${lastReason})` : ""}. Coba lagi.` },
        { status: 502 }
      );
    }

    // Attempts ran out but we do have a candidate: hand it over flagged rather
    // than discarding it. The quota is already spent, and the user asked to see
    // the result and decide, rather than lose the call outright.
    const stillSimilar = !accepted;
    let result = (accepted ?? lastCandidate)!;

    // Same check-then-rephrase-once shape as generate/ and regenerate-scene/:
    // a fresh caption can smuggle in a banned claim, and nothing else screens it.
    let policyViolations = checkPolicyCompliance({ scenes: [], caption: result.caption, hashtags: result.hashtags }, contentGoal, facts.knownNumbers);
    if (policyViolations.length > 0) {
      try {
        const rephrased = await generateWithFallback(providerOrder, keys, buildCaptionRephrasePrompt(result.caption, policyViolations), []);
        const newCaption = parseCaptionResponse(rephrased.text);
        if (newCaption) {
          result = { ...result, caption: newCaption };
          policyViolations = checkPolicyCompliance({ scenes: [], caption: result.caption, hashtags: result.hashtags }, contentGoal, facts.knownNumbers);
        }
      } catch {
        // Best-effort, exactly as in generate/: keep the caption and let the
        // violation surface as a warning rather than failing the request.
      }
    }

    // Keep the stored generation in step with what is on screen. generate/
    // writes caption+hashtags into content_generations, and video_contents FKs
    // to that row -- leaving it stale would record a caption that was never
    // used and would make the NEXT generate avoid the wrong text.
    if (contentGenerationId) {
      await db
        .update(contentGenerations)
        .set({ caption: result.caption, hashtags: result.hashtags })
        .where(eq(contentGenerations.id, contentGenerationId));
    }

    const warnings = [
      ...formatPolicyViolations(policyViolations),
      ...(stillSimilar && lastReason ? [`${lastReason} Klik Regenerate lagi kalau mau versi yang lebih berbeda.`] : []),
    ];

    return NextResponse.json({ caption: result.caption, hashtags: result.hashtags, warnings, stillSimilar });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal regenerate caption." },
      { status: 502 }
    );
  }
}
