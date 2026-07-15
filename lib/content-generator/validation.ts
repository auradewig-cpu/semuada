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

// Scenes round-trip through our own generate response (previousScene/nextScene/
// currentScene) -- they're already shaped by our own code, so a full nested
// schema isn't worth the upkeep. Just require it to be an object when present.
const sceneShapeSchema = z.record(z.string(), z.unknown());

export const generateRequestSchema = z
  .object({
    productId: z.string().min(1, "productId wajib diisi."),
    selectedImageUrls: z.array(z.string().url()).min(1, "Minimal 1 gambar produk wajib dipilih."),
    characterId: z.string().nullable().default(null),
    style: contentStyleSchema,
    aiTool: aiToolSchema,
    platform: platformSchema,
    aspectRatio: aspectRatioSchema,
    hookArchetype: hookArchetypeSchema,
    contentGoal: contentGoalSchema,
    ctaType: ctaTypeSchema,
    sceneDurations: z.array(z.number().int().positive()).min(1),
    includePrice: z.boolean().default(true),
    narrationMode: narrationModeSchema.default("lipsync"),
    cameraPattern: cameraPatternSchema.default("single_angle"),
  })
  .refine((data) => data.sceneDurations.length === data.selectedImageUrls.length, {
    message: "Jumlah durasi scene harus sama dengan jumlah gambar yang dipilih.",
    path: ["sceneDurations"],
  });

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
  sceneIndex: z.number().int().min(0),
  sceneDuration: z.number().int().positive(),
  totalScenes: z.number().int().positive(),
  productImageUrl: z.string().url(),
  previousScene: sceneShapeSchema.nullable().default(null),
  nextScene: sceneShapeSchema.nullable().default(null),
  includePrice: z.boolean().default(true),
  narrationMode: narrationModeSchema.default("lipsync"),
  cameraPattern: cameraPatternSchema.default("single_angle"),
});

export const hookVariantsRequestSchema = z.object({
  productId: z.string().min(1),
  characterId: z.string().nullable().default(null),
  style: contentStyleSchema,
  aiTool: aiToolSchema,
  platform: platformSchema,
  aspectRatio: aspectRatioSchema,
  currentArchetype: hookArchetypeSchema,
  sceneDuration: z.number().int().positive(),
  productImageUrl: z.string().url(),
  currentScene: sceneShapeSchema,
  includePrice: z.boolean().default(true),
  narrationMode: narrationModeSchema.default("lipsync"),
  cameraPattern: cameraPatternSchema.default("single_angle"),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
