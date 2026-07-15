import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Character {
  id: string;
  name: string;
  photoUrl: string;
  description: string | null;
  createdAt: string;
}

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

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      selectedImageUrls: string[];
      characterId: string | null;
      style: 'vlog' | 'content_creator' | 'faceless_pov';
    }) => {
      const res = await apiRequest('POST', '/api/content-generator/generate', input);
      return res.json() as Promise<{ result: GenerationResult; warnings: string[] }>;
    },
  });
}
