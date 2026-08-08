import { useMemo, useState } from 'react';
import { CalendarClock, Settings2, TriangleAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchedulerAccounts, useScheduledPosts, type ScheduledPost } from "@/hooks/useScheduler";
import { SchedulerAccountsDialog } from "@/components/admin/content-generator/SchedulerAccountsDialog";

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

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function SchedulerTab() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [isAccountsDialogOpen, setIsAccountsDialogOpen] = useState(false);

  const { data: accountsData, isLoading: isLoadingAccounts } = useSchedulerAccounts();
  const { data: postsData, isLoading: isLoadingPosts } = useScheduledPosts(selectedAccountId);

  const accounts = accountsData?.items ?? [];
  const posts = postsData?.items ?? [];

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => {
                const account = accounts.find((a) => a.id === post.scheduler_account_id);
                const badge = STATUS_BADGE[post.status];
                return (
                  <Card key={post.id} className="overflow-hidden">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={post.video_url} controls className="w-full aspect-[9/16] bg-black object-contain" />
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
                            <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-muted rounded px-1.5 py-0.5">
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
                      {post.error_message && (
                        <p className="text-[10px] text-destructive line-clamp-2">{post.error_message}</p>
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
    </div>
  );
}
