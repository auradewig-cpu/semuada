import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Settings2, TriangleAlert, CheckCircle2, XCircle, Clock, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSchedulerAccounts, useScheduledPosts, useBuildScheduleNow, useSwapScheduledPostVideo, useRetryScheduledPost, type ScheduledPost } from "@/hooks/useScheduler";
import { SchedulerAccountsDialog } from "@/components/admin/content-generator/SchedulerAccountsDialog";
import { VideoPickerDialog } from "@/components/admin/content-generator/VideoPickerDialog";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  threads: 'Threads',
  facebook_page: 'FB Page',
};

const STATUS_BADGE: Record<ScheduledPost['status'], { label: string; className: string }> = {
  queued: { label: 'Menunggu', className: 'bg-muted text-muted-foreground' },
  posted: { label: 'Terposting', className: 'bg-green-600/10 text-green-700 dark:text-green-400' },
  failed: { label: 'Gagal', className: 'bg-destructive/10 text-destructive' },
};

// Card size is really a column count -- the videos are 9:16, so fitting more
// per row is what actually makes them smaller. Written as complete class
// strings because Tailwind only ships classes it can find literally in the
// source; assembling them at runtime would leave the styles unbuilt.
const VIDEO_SIZES = {
  kecil: { label: 'Kecil', grid: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' },
  sedang: { label: 'Sedang', grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' },
  besar: { label: 'Besar', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' },
} as const;

type VideoSize = keyof typeof VIDEO_SIZES;

const VIDEO_SIZE_STORAGE_KEY = 'schedulerVideoSize';
const DEFAULT_VIDEO_SIZE: VideoSize = 'sedang';

function isVideoSize(value: string | null): value is VideoSize {
  return value === 'kecil' || value === 'sedang' || value === 'besar';
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Platforms without a recorded ok:true result -- covers both a fully
// "failed" post and a "posted" post where only SOME platforms succeeded
// (status flips to "posted" the moment any one platform succeeds, so this
// can't just check status === 'failed' or partial failures would have no
// retry path). Mirrors platformsNeedingDispatch() server-side -- the retry
// endpoint only re-dispatches this same subset, so this list is also what
// actually gets retried, not post.platforms as a whole.
function getFailedPlatforms(post: ScheduledPost): string[] {
  if (post.status === 'queued') return [];
  return post.platforms.filter((p) => post.provider_results?.[p]?.ok !== true);
}

export function SchedulerTab() {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [isAccountsDialogOpen, setIsAccountsDialogOpen] = useState(false);

  const { data: accountsData, isLoading: isLoadingAccounts } = useSchedulerAccounts();
  const { data: postsData, isLoading: isLoadingPosts } = useScheduledPosts(selectedAccountId);
  const buildScheduleNow = useBuildScheduleNow();
  const swapVideo = useSwapScheduledPostVideo();
  const retryPost = useRetryScheduledPost();
  const [pickerForPost, setPickerForPost] = useState<ScheduledPost | null>(null);
  const [confirmBuildNow, setConfirmBuildNow] = useState(false);
  const [confirmRetryPost, setConfirmRetryPost] = useState<ScheduledPost | null>(null);

  // Starts at the default and is restored from localStorage after mount
  // rather than read during render -- this page is prerendered, so reading
  // browser storage on the first pass would render different markup on the
  // server than on the client. Same approach as Home.tsx's filter panel.
  const [videoSize, setVideoSize] = useState<VideoSize>(DEFAULT_VIDEO_SIZE);

  useEffect(() => {
    const stored = localStorage.getItem(VIDEO_SIZE_STORAGE_KEY);
    if (isVideoSize(stored)) setVideoSize(stored);
  }, []);

  const handleVideoSizeChange = (value: string) => {
    if (!isVideoSize(value)) return;
    setVideoSize(value);
    localStorage.setItem(VIDEO_SIZE_STORAGE_KEY, value);
  };

  const accounts = accountsData?.items ?? [];
  const posts = postsData?.items ?? [];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleSwapVideo = (video: { id: string }) => {
    if (!pickerForPost) return;
    swapVideo.mutate(
      { postId: pickerForPost.id, videoContentId: video.id },
      {
        onSuccess: () => toast({ title: 'Video diganti', description: 'Slot ini sekarang memakai video yang baru dipilih.' }),
        onError: (error) => toast({ variant: 'destructive', title: 'Gagal mengganti video', description: error.message }),
      }
    );
  };

  const handleBuildNow = () => {
    if (!selectedAccountId) return;
    buildScheduleNow.mutate(selectedAccountId, {
      onSuccess: (data) => {
        const buildNote =
          data.buildResult.status === 'already_built'
            ? 'Sudah dijadwalkan hari ini, tidak ada slot baru.'
            : `${data.buildResult.slotsBuilt} slot baru dibuat${data.buildResult.slotsSkipped > 0 ? ` (${data.buildResult.slotsSkipped} kekurangan video)` : ''}.`;
        const { attempted, posted, failed, errors } = data.dispatch;
        const dispatchNote =
          attempted === 0
            ? 'Tidak ada yang perlu diposting sekarang.'
            : `${posted} berhasil diposting${failed > 0 ? `, ${failed} gagal (${errors[0] ?? 'lihat detail di kartu'})` : ''}.`;
        toast({
          variant: failed > 0 ? 'destructive' : 'default',
          title: failed > 0 ? 'Sebagian gagal posting' : 'Berhasil diposting',
          description: `${buildNote} ${dispatchNote}`,
        });
      },
      onError: (error) => toast({ variant: 'destructive', title: 'Gagal menjadwalkan', description: error.message }),
    });
  };

  const handleRetryPost = () => {
    if (!confirmRetryPost) return;
    retryPost.mutate(confirmRetryPost.id, {
      onSuccess: (data) => {
        toast({
          variant: data.retrySucceeded ? 'default' : 'destructive',
          title: data.retrySucceeded ? 'Berhasil diposting' : 'Masih gagal',
          description: data.retrySucceeded
            ? 'Video berhasil diposting ulang.'
            : (data.retryErrorMessage ?? 'Percobaan ulang masih gagal, lihat detail di kartu.'),
        });
      },
      onError: (error) => toast({ variant: 'destructive', title: 'Gagal mencoba ulang', description: error.message }),
    });
  };

  // Compares today's queued+posted rows per account against how many slots
  // its base_times pattern expects -- a shortfall means the pool ran dry
  // when build-schedule last ran for that account.
  const poolWarnings = useMemo(() => {
    const todaysCountByAccount = new Map<string, number>();
    for (const p of posts) {
      if (!isToday(p.scheduled_for)) continue;
      todaysCountByAccount.set(p.scheduler_account_id, (todaysCountByAccount.get(p.scheduler_account_id) ?? 0) + 1);
    }
    return accounts
      .filter((a) => a.is_active)
      .map((a) => ({ account: a, todayCount: todaysCountByAccount.get(a.id) ?? 0, expected: a.base_times.length }))
      .filter((w) => w.todayCount < w.expected);
  }, [accounts, posts]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <span className="flex items-center">
              <CalendarClock className="h-5 w-5 mr-2" />
              Scheduler{accounts.length > 0 ? ` · ${accounts.length} akun` : ''}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedAccountId ?? 'all'} onValueChange={(v) => setSelectedAccountId(v === 'all' ? undefined : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Semua Akun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Akun</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={videoSize} onValueChange={handleVideoSizeChange}>
                <SelectTrigger className="w-32" aria-label="Ukuran video">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VIDEO_SIZES).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmBuildNow(true)} disabled={buildScheduleNow.isPending}>
                  <Zap className="h-4 w-4 mr-1" /> {buildScheduleNow.isPending ? 'Memposting...' : 'Jadwalkan & Post Sekarang'}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setIsAccountsDialogOpen(true)}>
                <Settings2 className="h-4 w-4 mr-1" /> Kelola Akun Scheduler
              </Button>
            </div>
          </CardTitle>

          {poolWarnings.length > 0 && (
            <div className="space-y-1 pt-1">
              {poolWarnings.map(({ account, todayCount, expected }) => (
                <div key={account.id} className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{account.label}</strong>: video kurang hari ini ({todayCount}/{expected} slot terisi) -- tambah video di Video Library untuk kategori "{account.category}".
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoadingAccounts || isLoadingPosts ? (
            <p className="text-sm text-muted-foreground">Memuat jadwal...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada akun scheduler -- klik "Kelola Akun Scheduler" untuk menambah.</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada jadwal. Jadwal dibuat otomatis tiap hari dari video yang tersedia di Video Library.</p>
          ) : (
            <div className={`grid ${VIDEO_SIZES[videoSize].grid} gap-4`}>
              {posts.map((post) => {
                const account = accounts.find((a) => a.id === post.scheduler_account_id);
                const badge = STATUS_BADGE[post.status];
                const failedPlatforms = getFailedPlatforms(post);
                return (
                  <Card key={post.id} className="overflow-hidden">
                    {post.video_purged ? (
                      <div className="w-full aspect-[9/16] bg-muted flex items-center justify-center p-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          Video sudah dihapus permanen setelah 30 hari di sampah. Riwayat postingan ini tetap tersimpan.
                        </p>
                      </div>
                    ) : (
                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
                      <video src={post.video_url} controls className="w-full aspect-[9/16] bg-black object-contain" />
                    )}
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium bg-muted rounded px-2 py-0.5 truncate">
                          {account?.label ?? '-'}
                        </span>
                        <span className={`text-xs font-medium rounded px-2 py-0.5 shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(post.scheduled_for).toLocaleString('id-ID')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {post.platforms.map((p) => {
                          const result = post.provider_results?.[p];
                          return (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 text-[10px] bg-muted rounded px-1.5 py-0.5"
                              title={!result?.ok ? result?.error : undefined}
                            >
                              {post.status === 'queued' ? null : result?.ok ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <XCircle className="h-3 w-3 text-destructive" />
                              )}
                              {PLATFORM_LABELS[p] ?? p}
                            </span>
                          );
                        })}
                      </div>
                      {post.caption && <p className="text-xs line-clamp-2">{post.caption}</p>}
                      {(post.error_message || failedPlatforms.length > 0) && (
                        <p className="text-[10px] text-destructive line-clamp-2">
                          {post.error_message
                            ?? failedPlatforms
                              .map((p) => `${PLATFORM_LABELS[p] ?? p}: ${post.provider_results?.[p]?.error ?? 'gagal'}`)
                              .join(' · ')}
                        </p>
                      )}
                      {post.status === 'queued' && (
                        <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setPickerForPost(post)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Ganti Video
                        </Button>
                      )}
                      {failedPlatforms.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={retryPost.isPending}
                          onClick={() => setConfirmRetryPost(post)}
                        >
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          {post.status === 'posted'
                            ? `Coba Lagi (${failedPlatforms.length} Platform Gagal)`
                            : 'Jadwalkan & Post Sekarang'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SchedulerAccountsDialog isOpen={isAccountsDialogOpen} onOpenChange={setIsAccountsDialogOpen} />

      {pickerForPost && (
        <VideoPickerDialog
          isOpen={pickerForPost !== null}
          onOpenChange={(open) => !open && setPickerForPost(null)}
          category={accounts.find((a) => a.id === pickerForPost.scheduler_account_id)?.category ?? ''}
          excludeVideoId={pickerForPost.video_content_id}
          onSelect={handleSwapVideo}
        />
      )}

      <AlertDialog open={confirmBuildNow} onOpenChange={setConfirmBuildNow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jadwalkan & post sekarang untuk "{selectedAccount?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Ini akan langsung memposting video ke TikTok/Instagram/YouTube (via Buffer) dan Threads/FB Page (via Zernio) yang terhubung ke akun ini -- bukan sekadar antre, tapi benar-benar tayang sekarang juga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmBuildNow(false); handleBuildNow(); }}>
              Ya, Post Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRetryPost !== null} onOpenChange={(open) => !open && setConfirmRetryPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Coba jadwalkan & post sekarang ulang?</AlertDialogTitle>
            <AlertDialogDescription>
              Video ini akan langsung dicoba post lagi ke platform yang tadi gagal ({confirmRetryPost ? getFailedPlatforms(confirmRetryPost).map((p) => PLATFORM_LABELS[p] ?? p).join(', ') : ''}) --
              platform yang sudah berhasil sebelumnya TIDAK akan diposting ulang. Bukan sekadar antre, langsung tayang sekarang juga kalau berhasil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRetryPost(null); handleRetryPost(); }}>
              Ya, Coba Lagi Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
