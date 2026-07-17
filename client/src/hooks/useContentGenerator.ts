import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Character {
  id: string;
  name: string;
  photoUrl: string;
  description: string | null;
  createdAt: string;
}

export type ContentStyleId =
  | 'direct_response'
  | 'vlog_daily'
  | 'tutorial_howto'
  | 'storytime'
  | 'listicle_countdown'
  | 'before_after'
  | 'pattern_break_twist'
  | 'series_episodic';

export type AiToolId = 'google_flow' | 'veo3' | 'kling_ai' | 'runway_gen4' | 'luma_dream' | 'pika_labs' | 'sora';
export type PlatformTarget = 'shopee_video' | 'instagram_reels' | 'facebook_reels' | 'youtube_shorts';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '3:4';
export type HookArchetype = 'unpopular_opinion' | 'pov_realism' | 'specific_outcome' | 'curiosity_gap' | 'relatable' | 'emotional' | 'mistake_warning';
export type ContentGoal = 'conversion' | 'growth' | 'engagement';
export type CtaTypeId =
  | 'link_bio'
  | 'dm_whatsapp'
  | 'comment_keyword'
  | 'follow_more'
  | 'share_tag_friend'
  | 'visit_website'
  | 'limited_urgency'
  | 'save_for_later'
  | 'klik_keranjang_kuning';

export const GROWTH_ALLOWED_CTAS: CtaTypeId[] = ['follow_more', 'save_for_later', 'share_tag_friend', 'comment_keyword'];

export type NarrationMode = 'lipsync' | 'voiceover';
export type CameraPattern = 'single_angle' | 'aroll_broll';

export interface SceneOutput {
  scene_number: number;
  duration_seconds: number;
  speech_pace: string;
  script_narration: string;
  script_word_count: number;
  visual_description: string;
  camera_direction: string;
  text_overlay: string;
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

// One planned scene: which product photo (may repeat across scenes), how
// long, and optional per-scene override for narration/camera (null = inherit
// the request-level global default).
export interface SceneInput {
  imageUrl: string;
  duration: number;
  narrationMode: NarrationMode | null;
  cameraPattern: CameraPattern | null;
}

export interface GenerateContentInput {
  productId: string;
  scenes: SceneInput[];
  characterId: string | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export function useCharacters() {
  return useQuery<{ items: Character[] }>({
    queryKey: ['characters'],
    queryFn: () => fetchJson('/api/content-generator/characters'),
  });
}

export function useAddCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, photo, description }: { name: string; photo: File; description?: string }) => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('photo', photo);
      if (description) formData.append('description', description);

      const res = await fetch('/api/content-generator/characters', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<Character>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/content-generator/characters/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

export function useDeleteAllCharacters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/content-generator/characters');
      return res.json() as Promise<{ ok: boolean; deleted: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (input: GenerateContentInput) => {
      const res = await apiRequest('POST', '/api/content-generator/generate', input);
      return res.json() as Promise<{ result: GenerationResult; warnings: string[] }>;
    },
  });
}

export interface RegenerateSceneInput {
  productId: string;
  characterId: string | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
  sceneIndex: number;
  sceneDuration: number;
  totalScenes: number;
  productImageUrl: string;
  previousScene: SceneOutput | null;
  nextScene: SceneOutput | null;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
}

export function useRegenerateScene() {
  return useMutation({
    mutationFn: async (input: RegenerateSceneInput) => {
      const res = await apiRequest('POST', '/api/content-generator/regenerate-scene', input);
      return res.json() as Promise<{ scene: SceneOutput; warnings: string[] }>;
    },
  });
}

export interface HookVariantsInput {
  productId: string;
  characterId: string | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  currentArchetype: HookArchetype;
  sceneDuration: number;
  productImageUrl: string;
  currentScene: SceneOutput;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
}

export function useHookVariants() {
  return useMutation({
    mutationFn: async (input: HookVariantsInput) => {
      const res = await apiRequest('POST', '/api/content-generator/hook-variants', input);
      return res.json() as Promise<{ variants: SceneOutput[]; warnings: string[] }>;
    },
  });
}
