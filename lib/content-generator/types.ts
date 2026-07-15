export type ContentStyleId =
  | "direct_response"
  | "vlog_daily"
  | "tutorial_howto"
  | "storytime"
  | "listicle_countdown"
  | "before_after"
  | "pattern_break_twist"
  | "series_episodic";

export type AiProvider = "gemini" | "groq" | "openrouter" | "deepseek";

export type AiToolId = "google_flow" | "veo3" | "kling_ai" | "runway_gen4" | "luma_dream" | "pika_labs" | "sora";

export type PlatformTarget = "shopee_video" | "instagram_reels" | "facebook_reels" | "youtube_shorts";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "3:4";

export type HookArchetype =
  | "unpopular_opinion"
  | "pov_realism"
  | "specific_outcome"
  | "curiosity_gap"
  | "relatable"
  | "emotional";

export type ContentGoal = "conversion" | "growth" | "engagement";

export type CtaTypeId =
  | "link_bio"
  | "dm_whatsapp"
  | "comment_keyword"
  | "follow_more"
  | "share_tag_friend"
  | "visit_website"
  | "limited_urgency"
  | "save_for_later"
  | "klik_keranjang_kuning";

// Growth-goal content may not use hard-sell CTAs -- mirrors ViralFrame's
// GROWTH_MODE_RULES gating (no jualan, only follow/save/share/comment asks).
export const GROWTH_ALLOWED_CTAS: CtaTypeId[] = ["follow_more", "save_for_later", "share_tag_friend", "comment_keyword"];

// lipsync = character speaks in sync with the narration (dialogue tag/quote
// embedded). voiceover = character performs/demos silently, audio is narration
// only (non-sync) -- no dialogue tag or quoted speech should appear at all.
export type NarrationMode = "lipsync" | "voiceover";

// single_angle = one consistent shot style per scene. aroll_broll = intercut
// between character shots (A-roll) and product cutaways (B-roll) within scenes.
export type CameraPattern = "single_angle" | "aroll_broll";

export interface SceneOutput {
  scene_number: number;
  duration_seconds: number;
  speech_pace: string;
  script_narration: string;
  script_word_count: number;
  visual_description: string;
  camera_direction: string;
  reference_images: {
    character: string | null;
    character_filename: string | null;
    product: string;
    product_filename: string;
  };
  ai_ready_prompt: string;
  transition_to_next: string;
}

export interface GenerationResult {
  scenes: SceneOutput[];
  caption: string;
  hashtags: string[];
}

// GenerateRequest is derived from generateRequestSchema (validation.ts) via
// z.infer, not hand-duplicated here -- a hand-written copy previously existed
// and was never actually used for type-checking anywhere, so it silently
// risked drifting from the real request shape enforced at the API boundary.
export type { GenerateRequest } from "./validation";
