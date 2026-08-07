import { getContentStyle } from "./contentStyles";
import { buildHookInstruction } from "./hookPatterns";
import { getAiToolSpec } from "./aiTools";
import { getPlatformSpec, buildPlatformBehavior } from "./platforms";
import { buildCtaInstruction, resolveCtaForGoal, resolveCtaForPlatform } from "./ctaTypes";
import { getLanguageTone, buildLanguageToneRule } from "./languageTones";
import { buildCinematographyRule, buildSingleTakeRule } from "./cinematography";
import { buildNegativePromptBlock, buildSpokenNumberRule } from "./negativePrompt";
import { pickExamples, deriveSeed, CAPTION_SHARE_BANK } from "./exampleBank";
import {
  buildCharacterBlock,
  buildDialogueRule,
  buildProductAnchorRule,
  buildProductPriceLine,
  buildPriceRule,
  buildCameraPatternRule,
  buildDeliveryTechniqueRule,
  buildPromptBudgetRule,
  buildAiReadyPromptStructureRule,
  buildRealismRule,
  buildBannedClaimsRule,
  buildWordCountSelfCheckRule,
} from "./promptFragments";
import type { AiToolId, AspectRatio, CameraPattern, ContentGoal, ContentStyleId, CtaTypeId, HookArchetype, LanguageTone, NarrationMode, PlatformTarget, SceneInput } from "./types";

interface MasterPromptInput {
  productName: string;
  category: string;
  price: string;
  scenes: SceneInput[];
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  languageTone: LanguageTone;
  characterName: string | null;
  characterDescription: string | null;
  narrationWpm: number;
  includePrice: boolean;
  // Request-level defaults, used for any scene that didn't set its own override.
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
  // Rotates every concrete example phrase in the prompt (tone vocabulary, hook
  // openers, CTA phrasings, spoken-price example) so consecutive generations of
  // the same product don't converge on identical wording. See exampleBank.ts.
  seed: number;
  // From variationContext.ts's buildAvoidRepetitionBlock() -- empty string
  // for a product's first-ever generation, so the prompt is byte-identical
  // to before this field existed when there's no history yet.
  avoidRepetitionBlock?: string;
}

export function compileMasterPrompt(input: MasterPromptInput): string {
  const style = getContentStyle(input.style);
  const toolSpec = getAiToolSpec(input.aiTool);
  const platformSpec = getPlatformSpec(input.platform);
  const sceneCount = input.scenes.length;
  const hasCharacter = input.characterName !== null;
  const hookInstruction = buildHookInstruction(input.hookArchetype, input.platform, input.scenes[0].duration, input.seed);
  // Two independent constraints: the content goal (growth can't hard-sell) and
  // the platform (Shopee's yellow cart doesn't exist off-Shopee, and external
  // links don't work inside the Shopee player). Previously only the goal was
  // applied, so an Instagram video could be told to say "klik keranjang kuning".
  const effectiveCta = resolveCtaForPlatform(resolveCtaForGoal(input.ctaType, input.contentGoal), input.platform);
  const toneSpec = getLanguageTone(input.languageTone);

  const characterBlock = buildCharacterBlock(input.characterName, input.characterDescription);
  const productAnchorRule = buildProductAnchorRule(input.productName, input.category);
  const priceLine = buildProductPriceLine(input.price, input.includePrice);
  const priceRule = buildPriceRule(input.includePrice, sceneCount, input.contentGoal);

  // Per-scene narration/camera instructions -- each scene resolves its own
  // override (or falls back to the request-level default), so e.g. scene 1
  // can be voiceover B-roll while scene 2 is lipsync talking head.
  const perSceneDirection = input.scenes
    .map((scene, i) => {
      const narrationMode = scene.narrationMode ?? input.narrationMode;
      const cameraPattern = scene.cameraPattern ?? input.cameraPattern;
      return `Scene ${i + 1} (${scene.duration}s): ${buildDialogueRule(input.aiTool, narrationMode, hasCharacter, input.seed)} ${buildCameraPatternRule(cameraPattern)}`;
    })
    .join("\n");

  // Composes WITH the selected style instead of overriding it. The old version
  // restated a full scene-by-scene map for conversion mode, which conflicted
  // with every non-direct-response structureDescription emitted ~35 lines
  // earlier -- making the style selector largely decorative on the default goal,
  // and producing an outright contradiction on growth + direct_response.
  const ctaGoalNote =
    input.contentGoal === "growth"
      ? "TUJUAN KONTEN: Growth akun. Ikuti struktur gaya video di atas, tapi TANPA bahasa jualan -- hook dan penutup diarahkan ke follow/save/share/comment, bukan ke pembelian."
      : input.contentGoal === "engagement"
        ? "TUJUAN KONTEN: Engagement. Ikuti struktur gaya video di atas, dengan penekanan memancing komentar/interaksi dan CTA yang soft."
        : `TUJUAN KONTEN: Konversi. Ikuti struktur gaya video di atas, dengan penekanan tambahan: masalah/pain point yang relevan disinggung lebih awal, produk ditunjukkan beraksi (bukan cuma dipajang) dalam 3 detik pertama kemunculannya, dan penutupnya mengarah ke tindakan. JANGAN mengganti struktur gaya video -- ini penekanan di dalam struktur itu, bukan struktur pengganti.`;

  // Gated on the style's own ending semantics. Looping back to scene 1 undoes
  // the payoff for before/after (scene 1 IS the "before") and fights the
  // deliberately-unresolved ending of a series.
  const loopEndingRule =
    style.ctaIntensity === "hard"
      ? `Scene terakhir WAJIB ditutup dengan CTA yang jelas dan tegas sesuai gaya konten ini.`
      : style.endingSemantics === "open_loop"
        ? `Scene terakhir WAJIB ditutup dengan open loop yang menggantung dan genuinely earned${input.contentGoal === "conversion" ? ", disertai CTA ringan yang tidak merusak rasa menggantungnya" : ""}.`
        : style.endingSemantics === "resolve_payoff"
          ? `Scene terakhir WAJIB menuntaskan payoff-nya (hasil/resolusi terasa selesai) -- JANGAN kembali ke visual scene 1, itu justru membatalkan efek penutupnya.${input.contentGoal === "conversion" ? " Setelah payoff tuntas, selipkan CTA secara natural." : ""}`
          : input.contentGoal === "conversion"
            ? `Scene terakhir WAJIB tetap menyisipkan CTA ringan (selaras instruksi CTA di atas) meski gaya video ini biasanya soft-sell -- selipkan secara natural, BOLEH sekaligus menggestur balik ke visual scene 1 (loop-friendly) supaya tidak terasa hard-sell.`
            : `Scene terakhir ("transition_to_next") sebaiknya menggestur balik ke visual/tema scene 1 (loop-friendly) -- endingan yang mengundang tonton ulang dihitung sebagai engagement tinggi oleh algoritma, khususnya di Reels.`;

  const captionShareNote =
    input.platform === "instagram_reels" || input.platform === "facebook_reels"
      ? `Caption sebaiknya memakai frasa yang mengundang dikirim ke teman (arah rasanya seperti "${pickExamples(CAPTION_SHARE_BANK, 1, deriveSeed(input.seed, 4))[0]}", susun dengan kata-katamu sendiri) -- DM-share adalah sinyal reach terkuat di platform ini pada 2026.`
      : "";

  const negativeBlock = buildNegativePromptBlock({
    sceneCount,
    allowsVisualChange: style.allowsVisualChange,
    supportsNegativePromptField: toolSpec.supportsNegativePrompt,
  });

  const negativePromptField = toolSpec.supportsNegativePrompt ? `,\n      "negative_prompt": string` : "";

  return `
PERAN: Kamu adalah script writer video affiliate marketing untuk pasar Indonesia tahun 2026, ahli membuat video pendek yang terlihat autentik/real, bukan seperti dibuat AI.

PRODUK:
- Nama: ${input.productName}
- Kategori: ${input.category}
${priceLine}

${characterBlock}

GAYA VIDEO: ${style.label}
Struktur: ${style.structureDescription}
- Instruksi kamera: ${style.cameraInstruction}
- Instruksi nada bicara: ${style.narrativeVoiceGuidance}

${buildLanguageToneRule(input.languageTone, input.seed)}

${buildDeliveryTechniqueRule()}

PLATFORM TUJUAN: ${platformSpec.label} (rasio ${input.aspectRatio}, durasi ideal ${platformSpec.durationHint}, total video ini ${input.scenes.reduce((a, s) => a + s.duration, 0)}s)
${buildPlatformBehavior(input.platform, input.includePrice)}

AI VIDEO TOOL TUJUAN: ${toolSpec.label} (satu scene maksimal ~${toolSpec.maxDurationSeconds}s di tool ini)
Format ai_ready_prompt: ${toolSpec.formatTemplate}

${buildPromptBudgetRule(input.aiTool, hasCharacter)}

${buildAiReadyPromptStructureRule(hasCharacter, input.aspectRatio, toneSpec.genreAnchor)}

${buildCinematographyRule(input.aiTool)}

${buildSingleTakeRule()}

HOOK SCENE 1: ${hookInstruction}

${ctaGoalNote}
CTA: ${buildCtaInstruction(effectiveCta, input.seed)}
${loopEndingRule}
${captionShareNote}
${input.avoidRepetitionBlock ?? ""}
INSTRUKSI PER SCENE (mode narasi & pola kamera BISA BERBEDA antar scene, WAJIB ikuti persis per scene -- JANGAN disamaratakan):
${perSceneDirection}

ATURAN WAJIB (SANGAT PENTING):
1. Buat TEPAT ${sceneCount} scene. Ada ${sceneCount} foto produk dilampirkan berurutan sebagai referensi visual; pakai foto ke-N sebagai acuan tampilan produk di scene ke-N (foto yang sama bisa saja dilampirkan lebih dari sekali, itu wajar).
2. Durasi tiap scene SUDAH DITENTUKAN dan TIDAK BOLEH diubah: ${input.scenes.map((s, i) => `scene ${i + 1} = ${s.duration}s`).join(", ")}.
3. BAHASA PER FIELD (WAJIB DIPATUHI PERSIS): "script_narration" WAJIB Bahasa Indonesia. "visual_description", "camera_direction", dan "ai_ready_prompt" WAJIB Bahasa Inggris -- field-field ini dibaca oleh AI video tool, bukan manusia Indonesia. SATU-SATUNYA pengecualian: kutipan dialog di dalam "ai_ready_prompt" (kalau mode scene-nya lipsync) tetap Bahasa Indonesia apa adanya, karena video tool menyimpulkan bahasa ucapan dari isi kutipan itu -- menerjemahkannya akan membuat karakter bicara bahasa yang salah.
4. ${productAnchorRule}
5. ${priceRule}
6. Narasi harus terdengar natural, TIDAK monoton: intonasi hidup, artikulasi jelas, ada jeda natural sebelum kalimat penting. Target kecepatan bicara ${input.narrationWpm} kata per menit. Kalimat maksimal sekitar ${toneSpec.maxWordsPerSentence} kata (sesuai GAYA BAHASA yang dipilih) -- HINDARI kalimat majemuk yang jauh melebihi batas itu bersambung dengan "dan"/"yang"/"karena" berkali-kali, itu bikin AI voice salah penekanan dan terdengar "blibet". Pecah jadi beberapa kalimat terpisah kalau lebih panjang dari itu, masing-masing 1 ide saja.
7. ${buildBannedClaimsRule()}
8. ${buildRealismRule()}
9. ${buildSpokenNumberRule(input.seed)}
10. Setelah semua scene, buat SATU caption (bahasa Indonesia, singkat, catchy, kekinian) dan TEPAT 5 hashtag relevan (tanpa duplikat, tanpa tanda # ganda). Field "caption" HANYA berisi teks caption -- JANGAN sertakan hashtag apapun di dalam teks caption, hashtag HANYA boleh muncul di field "hashtags" terpisah.
11. ${buildWordCountSelfCheckRule()}
12. Isi "text_overlay" tiap scene: teks caption pendek (MAKSIMAL 8 kata, bahasa Indonesia) untuk di-burn-in di video saat editing -- BUKAN salinan penuh "script_narration", tapi inti pesan scene itu dalam bentuk singkat/punchy. Ini WAJIB diisi karena mayoritas penonton short-form video menonton tanpa suara.

${negativeBlock}

FORMAT OUTPUT -- HANYA JSON valid, TIDAK ADA teks lain di luar JSON, dengan struktur persis:
{
  "scenes": [
    {
      "scene_number": number,
      "duration_seconds": number,
      "speech_pace": string,
      "script_narration": string,
      "script_word_count": number,
      "visual_description": string,
      "camera_direction": string,
      "text_overlay": string,
      "transition_to_next": string,
      "ai_ready_prompt": string${negativePromptField}
    }
  ],
  "caption": string,
  "hashtags": string[]
}
`.trim();
}
