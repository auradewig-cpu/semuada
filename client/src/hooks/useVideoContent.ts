import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface VideoContent {
  id: string;
  product_id: string | null;
  category: string;
  subcategory: string | null;
  caption: string | null;
  hashtags: string[] | null;
  prompt_snapshot: string | null;
  video_url: string;
  cloudinary_public_id: string;
  status: string | null;
  // Set once a scheduled post using this video succeeds (see
  // lib/scheduler/dispatch.ts) -- starts the 30-day countdown before the
  // purge-trash cron permanently deletes it. Null = not in trash.
  trashed_at: string | null;
  // FK to the Content Generator output that produced this video (null for
  // manual uploads). Drives the Phase 5 learning pipeline.
  content_generation_id: string | null;
  // Which scheduler account this video is reserved for. Null = the shared
  // per-category pool any account may draw from. A reserved video is claimable
  // ONLY by its own account -- see lib/scheduler/videoPool.ts.
  scheduler_account_id: string | null;
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

export interface VideoContentStats {
  // Videos still available in the pool -- trashed ones are counted separately
  // below, never folded in here. See app/api/video-content/stats/route.ts.
  total: number;
  trashedTotal: number;
  byCategory: { category: string; available: number; trashed: number }[];
  // Per-lane stock: how many videos each active account has reserved and still
  // unposted. Every active account appears, including ones with an empty lane
  // -- an empty lane is precisely what needs to be seen before the account
  // quietly stops posting.
  lanes: { scheduler_account_id: string; label: string; category: string; available: number }[];
  // Videos reserved for nobody, per category -- what any account may still draw.
  sharedPool: { category: string; available: number }[];
}

export function useVideoContentStats() {
  return useQuery<VideoContentStats>({
    queryKey: ['video-content-stats'],
    queryFn: async () => {
      const res = await fetch('/api/video-content/stats', { credentials: 'include' });
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
      queryClient.invalidateQueries({ queryKey: ['video-content-stats'] });
    },
  });
}

export function useUpdateVideoContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; caption?: string; hashtags?: string[]; scheduler_account_id?: string | null }) => {
      const res = await apiRequest('PATCH', `/api/video-content/${id}`, payload);
      return res.json() as Promise<VideoContent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
      // Reassigning a lane moves stock between accounts, so the per-lane
      // counts on screen are stale until this refetches.
      queryClient.invalidateQueries({ queryKey: ['video-content-stats'] });
    },
  });
}

// Bulk lane assignment. `scheduler_account_id: null` returns the videos to the
// shared pool. One request rather than N -- see app/api/video-content/assign.
export function useAssignVideoLane() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; scheduler_account_id: string | null }) => {
      const res = await apiRequest('POST', '/api/video-content/assign', payload);
      return res.json() as Promise<{ ok: boolean; assigned: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
      queryClient.invalidateQueries({ queryKey: ['video-content-stats'] });
    },
  });
}

// Which accounts already hold videos of this product in their lane. Drives the
// contamination warning -- putting one product's videos on two accounts is the
// exact cross-account similarity lanes exist to prevent.
export interface ProductFocusEntry {
  scheduler_account_id: string;
  label: string;
  count: number;
}

export function useProductFocus(productId?: string | null) {
  return useQuery<{ items: ProductFocusEntry[] }>({
    queryKey: ['video-product-focus', productId],
    enabled: !!productId,
    queryFn: async () => {
      const res = await fetch(`/api/video-content/product-focus?product_id=${encodeURIComponent(productId!)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useCreateVideoContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      product_id?: string | null;
      category: string;
      subcategory: string | null;
      caption: string;
      hashtags: string[];
      prompt_snapshot?: string;
      video_url: string;
      cloudinary_public_id: string;
      storage_account_id?: string;
      content_generation_id?: string | null;
      // Reserve this upload for one account's lane; omit or null for the
      // shared per-category pool (the default).
      scheduler_account_id?: string | null;
    }) => {
      const res = await apiRequest('POST', '/api/video-content', payload);
      return res.json() as Promise<VideoContent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
      queryClient.invalidateQueries({ queryKey: ['video-content-stats'] });
    },
  });
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  // Which Cloudinary account (see useVideoStorageAccounts.ts) this landed in
  // -- carried straight from the /sign response, pass through to
  // useCreateVideoContent() as storage_account_id so the row always records
  // the account actually used, not a re-resolved guess.
  storage_account_id: string;
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
        const { timestamp, folder, signature, apiKey, cloudName, storageAccountId } = await signRes.json();

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
            resolve({ ...JSON.parse(xhr.responseText), storage_account_id: storageAccountId });
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
