import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface AiSettings {
  id: string;
  gemini_model: string;
  provider_order: string[];
  updated_at: string | null;
  has_gemini_key: boolean;
  has_groq_key: boolean;
  has_openrouter_key: boolean;
  has_deepseek_key: boolean;
}

export interface AiSettingsUpdate {
  gemini_api_key?: string;
  gemini_model?: string;
  groq_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  provider_order?: string[];
}

export function useAiSettings() {
  return useQuery<AiSettings>({
    queryKey: ['aiSettings'],
    queryFn: async () => {
      const res = await fetch('/api/content-generator/settings', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: AiSettingsUpdate) => {
      const res = await apiRequest('PUT', '/api/content-generator/settings', values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
}

export function useTestAiConnection() {
  return useMutation({
    mutationFn: async (provider: 'gemini' | 'groq' | 'openrouter' | 'deepseek') => {
      const res = await apiRequest('POST', '/api/content-generator/test-connection', { provider });
      return res.json() as Promise<{ ok: boolean; message: string }>;
    },
  });
}
