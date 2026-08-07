import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface VideoStorageAccount {
  id: string;
  category: string;
  cloud_name: string;
  has_api_key: boolean;
  has_api_secret: boolean;
  updated_at: string | null;
}

export function useVideoStorageAccounts() {
  return useQuery<{ items: VideoStorageAccount[] }>({
    queryKey: ['video-storage-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/video-content/storage-accounts', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useSaveVideoStorageAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { category: string; cloud_name: string; api_key: string; api_secret: string }) => {
      const res = await apiRequest('POST', '/api/video-content/storage-accounts', payload);
      return res.json() as Promise<VideoStorageAccount>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-storage-accounts'] });
    },
  });
}
