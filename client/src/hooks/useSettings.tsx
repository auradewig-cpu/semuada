import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Settings {
  id: string;
  show_category_filter: boolean;
  updated_at: string;
  facebook_pixel_id?: string | null;
  google_analytics_id?: string | null;
}

export function useSettings() {
  return useQuery<Settings | null>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newSettings: Partial<Omit<Settings, 'id' | 'updated_at'>>) => {
      const res = await apiRequest('PUT', '/api/settings', newSettings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
