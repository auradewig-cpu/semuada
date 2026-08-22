import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface SchedulerAccount {
  id: string;
  label: string;
  category: string;
  has_buffer_api_key: boolean;
  has_zernio_api_key: boolean;
  tiktok_account_id: string | null;
  instagram_account_id: string | null;
  youtube_account_id: string | null;
  threads_account_id: string | null;
  facebook_page_account_id: string | null;
  base_times: string[];
  /** @deprecated No longer drives the rotation -- see lib/scheduler/rotation.ts. */
  increment_minutes: number;
  cap_time: string;
  rotation_day_index: number;
  last_built_date: string | null;
  // When this account's frequency ramp began; null means no ramp (all
  // baseTimes are live). See activeSlotCount() in lib/scheduler/rotation.ts.
  ramp_started_at: string | null;
  is_active: boolean;
  updated_at: string | null;
}

export interface SchedulerAccountInput {
  id?: string;
  label: string;
  category: string;
  buffer_api_key?: string | null;
  zernio_api_key?: string | null;
  tiktok_account_id?: string | null;
  instagram_account_id?: string | null;
  youtube_account_id?: string | null;
  threads_account_id?: string | null;
  facebook_page_account_id?: string | null;
  base_times: string[];
  cap_time: string;
  is_active: boolean;
}

export interface ScheduledPost {
  id: string;
  scheduler_account_id: string;
  video_content_id: string;
  scheduled_for: string;
  platforms: string[];
  // 'dispatching' = a cron run has claimed this row and is calling the
  // providers. A row that stays there was interrupted mid-flight and is
  // deliberately never auto-reclaimed (the provider may already have accepted
  // it) -- see claimDuePosts() in lib/scheduler/dispatch.ts.
  status: 'queued' | 'dispatching' | 'posted' | 'failed';
  provider_results: Record<string, { ok: boolean; postId?: string; error?: string }> | null;
  posted_at: string | null;
  error_message: string | null;
  created_at: string | null;
  video_url: string;
  // True once the 30-day trash purge has destroyed the Cloudinary asset --
  // video_url is then a dead link, so render a placeholder instead.
  video_purged: boolean;
  caption: string | null;
  hashtags: string[] | null;
}

export function useSchedulerAccounts() {
  return useQuery<{ items: SchedulerAccount[] }>({
    queryKey: ['scheduler-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/scheduler-accounts', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useSaveSchedulerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SchedulerAccountInput) => {
      const res = await apiRequest('POST', '/api/scheduler-accounts', payload);
      return res.json() as Promise<SchedulerAccount>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-accounts'] });
    },
  });
}

export function useDeleteSchedulerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/scheduler-accounts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
    },
  });
}

export type BuildScheduleResult =
  | { status: 'already_built' }
  // The account has no channel ID on any platform, so nothing was built and
  // no video was claimed -- see buildScheduleForAccount().
  | { status: 'no_platforms' }
  | { status: 'built'; slotsBuilt: number; slotsSkipped: number };

export interface BuildAndDispatchResponse {
  ok: boolean;
  date: string;
  buildResult: BuildScheduleResult;
  dispatch: { attempted: number; posted: number; failed: number; errors: string[] };
}

// One click: builds today's queue (no-op if already built today) AND
// immediately posts everything still queued for this account to Buffer/
// Zernio -- not a preview. See app/api/scheduler-accounts/[id]/build-now/route.ts.
export function useBuildScheduleNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest('POST', `/api/scheduler-accounts/${accountId}/build-now`);
      return res.json() as Promise<BuildAndDispatchResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
    },
  });
}

export function useSwapScheduledPostVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, videoContentId }: { postId: string; videoContentId: string }) => {
      const res = await apiRequest('PATCH', `/api/scheduled-posts/${postId}`, { video_content_id: videoContentId });
      return res.json() as Promise<ScheduledPost>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
    },
  });
}

export interface RetryScheduledPostResponse {
  ok: boolean;
  status: ScheduledPost['status'];
  errorMessage: string | null;
  // Whether THIS retry attempt succeeded, distinct from `status` -- a post
  // can already be "posted" overall (from an earlier partial success) while
  // this specific retry of the still-failing platforms fails again.
  retrySucceeded: boolean;
  retryErrorMessage: string | null;
}

// Per-card "Jadwalkan & Post Sekarang" retry -- only valid for posts
// currently "failed" (see app/api/scheduled-posts/[id]/route.ts POST).
// Publishes immediately, not a preview -- has real, immediately-visible
// effects on the connected social accounts, same as the account-level
// manual trigger.
export function useRetryScheduledPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest('POST', `/api/scheduled-posts/${postId}/retry`);
      return res.json() as Promise<RetryScheduledPostResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['video-content'] });
    },
  });
}

export function useScheduledPosts(schedulerAccountId?: string) {
  return useQuery<{ items: ScheduledPost[] }>({
    queryKey: ['scheduled-posts', schedulerAccountId ?? 'all'],
    queryFn: async () => {
      const url = schedulerAccountId
        ? `/api/scheduled-posts?scheduler_account_id=${schedulerAccountId}`
        : '/api/scheduled-posts';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}
