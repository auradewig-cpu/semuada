export type ContentStyleId = "vlog" | "content_creator" | "faceless_pov";

export type AiProvider = "gemini" | "groq" | "openrouter" | "deepseek";

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
}
