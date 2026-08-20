import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Settings {
  id: string;
  show_category_filter: boolean;
  updated_at: string;
  facebook_pixel_id?: string | null;
  google_analytics_id?: string | null;
  site_name?: string | null;
  site_tagline?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  whatsapp_number?: string | null;
  social_facebook_url?: string | null;
  social_twitter_url?: string | null;
  social_instagram_url?: string | null;
  seo_meta_description?: string | null;
  og_image_url?: string | null;
  maintenance_mode?: boolean | null;
  maintenance_message?: string | null;
}

export function useSettings() {
  return useQuery<Settings | null>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    // app/layout.tsx prefetches this for every route. That layout is ISR-cached,
    // so the dehydrated dataUpdatedAt is the prerender time -- older than the
    // default 5-minute staleTime whenever a page has been sitting in the cache,
    // which made every such visit refetch settings over HTTP purely to get back
    // what the HTML already contained. Freshness is the server's job here
    // (revalidate = 60); admin edits still refetch, because useUpdateSettings
    // invalidates this key and invalidation refetches active queries.
    refetchOnMount: false,
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

// Uploads a site-wide image asset (logo, favicon, OG image) to blob storage
// and returns its public URL -- the caller is responsible for saving that
// URL onto the relevant settings field via useUpdateSettings().
export function useUploadSettingsImage() {
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);
      const res = await fetch('/api/settings/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<{ url: string }>;
    },
  });
}
