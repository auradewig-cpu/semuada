import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface VideoContent {
  id: string;
  product_id: string;
  category: string;
  subcategory: string | null;
  caption: string | null;
  hashtags: string[] | null;
  prompt_snapshot: string | null;
  video_url: string;
  cloudinary_public_id: string;
  status: string | null;
  created_at: string;
}

export function useVideoContents(category?: string) {
  return useQuery<{ items: VideoContent[] }>({
    queryKey: ['video-content', category ?? 'all'],
    queryFn: async () => {
      const url = category ? `/api/video-content?category=${encodeURIComponent(category)}` : '/api/video-content';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useDeleteVideoContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/video-content/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
    },
  });
}

export function useCreateVideoContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      product_id: string;
      category: string;
      subcategory: string | null;
      caption: string;
      hashtags: string[];
      prompt_snapshot: string;
      video_url: string;
      cloudinary_public_id: string;
    }) => {
      const res = await apiRequest('POST', '/api/video-content', payload);
      return res.json() as Promise<VideoContent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
    },
  });
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

// Uploads DIRECTLY from the browser to Cloudinary (not relayed through our
// server) using a short-lived signature from /api/video-content/sign -- see
// that route for why. XMLHttpRequest (not fetch) is used specifically
// because it's the only browser API that exposes upload progress events.
export function uploadVideoToCloudinary(
  file: File,
  category: string,
  onProgress: (percent: number) => void
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const signRes = await apiRequest('POST', '/api/video-content/sign', { category });
        const { timestamp, folder, signature, apiKey, cloudName } = await signRes.json();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', String(timestamp));
        formData.append('folder', folder);
        formData.append('signature', signature);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload gagal (${xhr.status}): ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload gagal: koneksi terputus.'));

        xhr.send(formData);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Upload gagal.'));
      }
    })();
  });
}
