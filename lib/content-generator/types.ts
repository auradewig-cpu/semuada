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

export interface GenerateRequest {
  productId: string;
  selectedImageUrls: string[];
  characterId: string | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  sceneDurations: number[];
}
