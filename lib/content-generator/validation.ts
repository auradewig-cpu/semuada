import { z } from "zod";

// Runtime validation at the API boundary -- previously these routes did
// manual `body.x` casts with no validation, so a malformed/wrong-typed
// request body would fail confusingly deep inside prompt-building instead
// of with a clear 400 at the door.

const contentStyleSchema = z.enum([
  "direct_response",
  "vlog_daily",
  "tutorial_howto",
  "storytime",
  "listicle_countdown",
  "before_after",
  "pattern_break_twist",
  "series_episodic",
]);

const aiToolSchema = z.enum(["google_flow", "veo3", "kling_ai", "runway_gen4", "luma_dream", "pika_labs", "sora"]);
const platformSchema = z.enum(["shopee_video", "instagram_reels", "facebook_reels", "youtube_shorts"]);
const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1", "4:5", "3:4"]);
const hookArchetypeSchema = z.enum([
  "unpopular_opinion",
  "pov_realism",
  "specific_outcome",
  "curiosity_gap",
  "relatable",
  "emotional",
  "mistake_warning",
]);
const contentGoalSchema = z.enum(["conversion", "growth", "engagement"]);
const ctaTypeSchema = z.enum([
  "link_bio",
  "dm_whatsapp",
  "comment_keyword",
  "follow_more",
  "share_tag_friend",
  "visit_website",
  "limited_urgency",
  "save_for_later",
  "klik_keranjang_kuning",
]);
const narrationModeSchema = z.enum(["lipsync", "voiceover"]);
const cameraPatternSchema = z.enum(["single_angle", "aroll_broll"]);
const narratorVoiceSchema = z.enum(["wanita", "pria"]);
const languageToneSchema = z.enum([
  "formal_netral",
  "santai_ngobrol",
  "gaul_kekinian",
  "elegan_premium",
  "heboh_lebay",
  "kocak_receh",
  "sotoy_santai",
  "curhat_personal",
  "sarkas_julid",
  "ibu_bapack_relatable",
]);

// Scenes round-trip through our own generate response (previousScene/nextScene/
// currentScene) -- they're already shaped by our own code, so a full nested
// schema isn't worth the upkeep. Just require it to be an object when present.
const sceneShapeSchema = z.record(z.string(), z.unknown());

// One planned scene: product photo (same URL may repeat across scenes),
// duration, and optional per-scene narration/camera override (null = inherit
// the request-level global default below).
const sceneInputSchema = z.object({
  imageUrl: z.string().url(),
  duration: z.number().int().min(2, "Durasi scene minimal 2 detik.").max(60, "Durasi scene maksimal 60 detik."),
  narrationMode: narrationModeSchema.nullable().default(null),
  cameraPattern: cameraPatternSchema.nullable().default(null),
});

// Hard cap: beyond ~10 scenes a single generate call risks blowing Gemini's
// maxOutputTokens (16384) and failing with MAX_TOKENS after burning quota.
export const MAX_SCENES = 10;

export const generateRequestSchema = z.object({
  productId: z.string().min(1, "productId wajib diisi."),
  scenes: z
    .array(sceneInputSchema)
    .min(1, "Minimal 1 scene wajib diisi.")
    .max(MAX_SCENES, `Maksimal ${MAX_SCENES} scene per generate.`),
  characterId: z.string().nullable().default(null),
  style: contentStyleSchema,
  aiTool: aiToolSchema,
  platform: platformSchema,
  aspectRatio: aspectRatioSchema,
  hookArchetype: hookArchetypeSchema,
  contentGoal: contentGoalSchema,
  ctaType: ctaTypeSchema,
  languageTone: languageToneSchema.default("gaul_kekinian"),
  includePrice: z.boolean().default(true),
  narrationMode: narrationModeSchema.default("lipsync"),
  cameraPattern: cameraPatternSchema.default("single_angle"),
  narratorVoice: narratorVoiceSchema.default("wanita"),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const regenerateSceneRequestSchema = z.object({
  productId: z.string().min(1),
  characterId: z.string().nullable().default(null),
  style: contentStyleSchema,
  aiTool: aiToolSchema,
  platform: platformSchema,
  aspectRatio: aspectRatioSchema,
  hookArchetype: hookArchetypeSchema,
  contentGoal: contentGoalSchema,
  ctaType: ctaTypeSchema,
  languageTone: languageToneSchema.default("gaul_kekinian"),
  sceneIndex: z.number().int().min(0),
  sceneDuration: z.number().int().positive(),
  totalScenes: z.number().int().positive(),
  productImageUrl: z.string().url(),
  previousScene: sceneShapeSchema.nullable().default(null),
  nextScene: sceneShapeSchema.nullable().default(null),
  includePrice: z.boolean().default(true),
  // These carry the EFFECTIVE per-scene mode (the scene's own override, or the
  // request-level default) resolved by the client from its scene-plan snapshot.
  // Before this, a regenerated scene always fell back to the global default and
  // silently discarded a deliberate per-scene override.
  narrationMode: narrationModeSchema.default("lipsync"),
  cameraPattern: cameraPatternSchema.default("single_angle"),
  narratorVoice: narratorVoiceSchema.default("wanita"),
});

export const hookVariantsRequestSchema = z.object({
  productId: z.string().min(1),
  characterId: z.string().nullable().default(null),
  style: contentStyleSchema,
  aiTool: aiToolSchema,
  platform: platformSchema,
  aspectRatio: aspectRatioSchema,
  currentArchetype: hookArchetypeSchema,
  // Without this the hook-variants route had to hardcode "conversion" for its
  // policy check, so growth-mode variants were never screened for hard-sell
  // language -- and clicking "Pakai" installed it straight into the video.
  contentGoal: contentGoalSchema.default("conversion"),
  languageTone: languageToneSchema.default("gaul_kekinian"),
  sceneDuration: z.number().int().positive(),
  productImageUrl: z.string().url(),
  currentScene: sceneShapeSchema,
  includePrice: z.boolean().default(true),
  narrationMode: narrationModeSchema.default("lipsync"),
  cameraPattern: cameraPatternSchema.default("single_angle"),
  narratorVoice: narratorVoiceSchema.default("wanita"),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
