import { useMemo, useState } from "react";
import { CreativePerformanceCard } from "@/components/admin/CreativePerformanceCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowUpDown, BarChart3, Eye, Heart, Info, RefreshCw, Users } from "lucide-react";
import {
  useSchedulerMetrics,
  type MetricsPeriod,
  type SocialAccount,
  type SocialMetricRow,
} from "@/hooks/useSchedulerMetrics";
import {
  columnValue,
  engagementOf,
  fmt,
  formatColumn,
  METRIC_GROUPS,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  platformReports,
  sumOrNull,
  type MetricColumn,
  type MetricGroupId,
} from "@/lib/socialMetrics";

/** One line of the Akun x Platform table. */
interface AccountPlatformRow {
  account: SocialAccount;
  platform: string;
  connected: boolean;
  targeted: number;
  published: number;
  failed: number;
  rows: SocialMetricRow[];
}

function StatCard({
  title, value, hint, icon: Icon, loading,
}: { title: string; value: string; hint?: string; icon: typeof Eye; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <div className="h-8 w-24 bg-muted rounded animate-pulse" /> : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** A metric cell that keeps "not measurable" and "no data yet" distinguishable. */
function MetricCell({ rows, platform, column }: { rows: SocialMetricRow[]; platform: string; column: MetricColumn }) {
  if (column.key !== "views_per_post" && !platformReports(platform, column.key)) {
    return <span className="text-muted-foreground/50" title="Platform ini tidak melaporkan metrik tersebut">—</span>;
  }
  if (rows.length === 0) {
    return <span className="text-muted-foreground/50" title="Belum ada metrik tersinkron">·</span>;
  }
  return <>{formatColumn(columnValue(rows, column), column)}</>;
}

export function DashboardTab() {
  const [period, setPeriod] = useState<MetricsPeriod>("all");
  const [category, setCategory] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [metricGroup, setMetricGroup] = useState<MetricGroupId>("jangkauan");
  const [sortKey, setSortKey] = useState<string>("views");
  const [videoSort, setVideoSort] = useState<string>("views");
  const { data, isLoading, isFetching, refetch } = useSchedulerMetrics(period);

  const columns = METRIC_GROUPS[metricGroup].columns;

  const allRows = useMemo(() => data?.items ?? [], [data]);
  const allAccounts = useMemo(() => data?.accounts ?? [], [data]);
  const allPublishing = useMemo(() => data?.publishing ?? [], [data]);

  // Categories and platforms come from configuration, not from the metric
  // rows: an account whose posts haven't been synced yet must still be listed.
  const categories = useMemo(
    () => Array.from(new Set(allAccounts.map((a) => a.category))).sort(),
    [allAccounts]
  );

  const rows = useMemo(
    () => allRows.filter((r) =>
      (category === "all" || r.category === category) && (platform === "all" || r.platform === platform)),
    [allRows, category, platform]
  );

  const accounts = useMemo(
    () => allAccounts.filter((a) => category === "all" || a.category === category),
    [allAccounts, category]
  );

  // Spine of the main table: every account crossed with every platform it is
  // connected to OR has ever been posted to. The union matters both ways --
  // a connected platform with no posts is a silent account, and a posted
  // platform that is no longer connected is a lost channel (Akun 1's YouTube
  // earned 214 views before its account id was cleared).
  const accountPlatformRows = useMemo<AccountPlatformRow[]>(() => {
    const metricsByKey = new Map<string, SocialMetricRow[]>();
    for (const row of rows) {
      const key = `${row.account_id}|${row.platform}`;
      if (!metricsByKey.has(key)) metricsByKey.set(key, []);
      metricsByKey.get(key)!.push(row);
    }

    const publishingByKey = new Map(allPublishing.map((p) => [`${p.account_id}|${p.platform}`, p]));

    const out: AccountPlatformRow[] = [];
    for (const account of accounts) {
      const seen = new Set<string>([
        ...account.platforms,
        ...allPublishing.filter((p) => p.account_id === account.id).map((p) => p.platform),
      ]);
      const ordered = PLATFORM_ORDER.filter((p) => seen.has(p)).concat(
        Array.from(seen).filter((p) => !PLATFORM_ORDER.includes(p))
      );
      for (const p of ordered) {
        if (platform !== "all" && p !== platform) continue;
        const pub = publishingByKey.get(`${account.id}|${p}`);
        out.push({
          account,
          platform: p,
          connected: account.platforms.includes(p),
          targeted: pub?.targeted ?? 0,
          published: pub?.published ?? 0,
          failed: pub?.failed ?? 0,
          rows: metricsByKey.get(`${account.id}|${p}`) ?? [],
        });
      }
    }
    return out;
  }, [accounts, allPublishing, rows, platform]);

  const sortedAccountPlatform = useMemo(() => {
    const copy = [...accountPlatformRows];
    const value = (r: AccountPlatformRow) => {
      if (sortKey === "failed") return r.failed;
      if (sortKey === "published") return r.published;
      if (sortKey === "targeted") return r.targeted;
      if (sortKey === "measured") return r.rows.length;
      const column = columns.find((c) => c.key === sortKey);
      return column ? columnValue(r.rows, column) ?? -1 : -1;
    };
    copy.sort((a, b) => value(b) - value(a));
    return copy;
  }, [accountPlatformRows, sortKey, columns]);

  const totals = useMemo(() => ({
    views: sumOrNull(rows, "views"),
    engagement: rows.reduce((sum, r) => sum + engagementOf(r), 0),
    posts: new Set(rows.map((r) => r.post_id)).size,
    videos: new Set(rows.map((r) => r.video_id)).size,
    accounts: accounts.length,
    accountsWithData: new Set(rows.map((r) => r.account_id)).size,
    failed: accountPlatformRows.reduce((sum, r) => sum + r.failed, 0),
  }), [rows, accounts, accountPlatformRows]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, SocialMetricRow[]>();
    for (const row of rows) {
      if (!map.has(row.platform)) map.set(row.platform, []);
      map.get(row.platform)!.push(row);
    }
    return Array.from(map.entries())
      .map(([name, platformRows]) => ({ name, rows: platformRows }))
      .sort((a, b) => (sumOrNull(b.rows, "views") ?? 0) - (sumOrNull(a.rows, "views") ?? 0));
  }, [rows]);

  const sortedVideos = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (videoSort === "posted_at") return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
      if (videoSort === "engagement") return engagementOf(b) - engagementOf(a);
      const column = columns.find((c) => c.key === videoSort) ?? columns[0];
      return (columnValue([b], column) ?? -1) - (columnValue([a], column) ?? -1);
    });
    return copy;
  }, [rows, videoSort, columns]);

  const coverage = data?.coverage;
  const thinHistory = (coverage?.distinct_days ?? 0) < 7;

  const SortableHead = ({ id, label, active, onSort }: { id: string; label: string; active: string; onSort: (v: string) => void }) => (
    <TableHead className="text-right">
      <button type="button" onClick={() => onSort(id)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active === id ? "text-foreground font-semibold" : ""}`}>
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* One control bar drives every table below, so no two of them can drift
          into showing different columns for the same thing. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as MetricsPeriod)} aria-label="Rentang waktu">
            <ToggleGroupItem value="7d" aria-label="7 hari terakhir">7H</ToggleGroupItem>
            <ToggleGroupItem value="30d" aria-label="30 hari terakhir">30H</ToggleGroupItem>
            <ToggleGroupItem value="90d" aria-label="90 hari terakhir">90H</ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="Semua waktu">Semua</ToggleGroupItem>
          </ToggleGroup>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Semua platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua platform</SelectItem>
              {PLATFORM_ORDER.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={metricGroup} aria-label="Kelompok metrik"
            onValueChange={(v) => { if (v) { setMetricGroup(v as MetricGroupId); setSortKey(METRIC_GROUPS[v as MetricGroupId].columns[0].key); setVideoSort(METRIC_GROUPS[v as MetricGroupId].columns[0].key); } }}>
            {(Object.keys(METRIC_GROUPS) as MetricGroupId[]).map((g) => (
              <ToggleGroupItem key={g} value={g}>{METRIC_GROUPS[g].label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* How much history exists. Comparative judgements ("this video is
          underperforming") need a baseline; saying so beats letting one day of
          data look like a trend. */}
      {!isLoading && coverage && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${thinHistory ? "border-yellow/40 bg-yellow/5" : "border-border bg-muted/30"}`}>
          {thinHistory ? <AlertCircle className="h-4 w-4 mt-0.5 text-yellow shrink-0" /> : <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
          <p className="text-muted-foreground">
            {coverage.distinct_days === 0 ? (
              <>Belum ada snapshot metrik sama sekali. Cron <code className="text-xs">sync-metrics</code> mengambil data sekali sehari.</>
            ) : (
              <>
                Riwayat metrik: <strong className="text-foreground">{coverage.distinct_days} hari</strong>
                {coverage.first_captured_on && coverage.last_captured_on && (<> ({coverage.first_captured_on} s/d {coverage.last_captured_on})</>)}
                . Angka di bawah adalah snapshot <strong className="text-foreground">terbaru</strong> tiap post, bukan penjumlahan antar-hari.
                {thinHistory && " Terlalu dini untuk membandingkan performa antar-video — butuh sekitar 2 minggu agar 'bagus' dan 'jelek' punya pembanding yang adil."}
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Views" value={fmt(totals.views)} icon={Eye} loading={isLoading} hint={`${totals.videos} video`} />
        <StatCard title="Total Interaksi" value={fmt(totals.engagement)} icon={Heart} loading={isLoading} hint="like + komentar + share + save" />
        <StatCard title="Post Terbit" value={fmt(totals.posts)} icon={BarChart3} loading={isLoading}
          hint={totals.failed > 0 ? `${totals.failed} gagal terbit` : `${rows.length} baris post x platform`} />
        <StatCard title="Akun" value={fmt(totals.accounts)} icon={Users} loading={isLoading}
          hint={`${totals.accountsWithData} sudah ada metrik · ${categories.length} kategori`} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <>
          {/* Akun x Platform -- the main view. Publish outcome sits beside the
              metrics because "0 views" means something completely different
              depending on whether the post ever went out. */}
          <Card>
            <CardHeader>
              <CardTitle>Akun × Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Akun</TableHead>
                      <TableHead>Platform</TableHead>
                      <SortableHead id="targeted" label="Post" active={sortKey} onSort={setSortKey} />
                      <SortableHead id="published" label="Terbit" active={sortKey} onSort={setSortKey} />
                      <SortableHead id="failed" label="Gagal" active={sortKey} onSort={setSortKey} />
                      <SortableHead id="measured" label="Terukur" active={sortKey} onSort={setSortKey} />
                      {columns.map((c) => (
                        <SortableHead key={c.key} id={c.key} label={c.label} active={sortKey} onSort={setSortKey} />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAccountPlatform.map((r) => (
                      <TableRow key={`${r.account.id}-${r.platform}`}>
                        <TableCell className="font-medium">
                          {r.account.label}
                          <div className="text-xs text-muted-foreground font-normal">{r.account.category}</div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {PLATFORM_LABELS[r.platform] ?? r.platform}
                          {!r.connected && (
                            <span className="ml-2 text-xs text-yellow" title="Platform ini tidak lagi terhubung di pengaturan akun">
                              tidak terhubung
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{r.targeted || "—"}</TableCell>
                        <TableCell className="text-right">{r.published || "—"}</TableCell>
                        <TableCell className={`text-right ${r.failed > 0 ? "text-red-500 font-semibold" : ""}`}>
                          {r.failed || "—"}
                        </TableCell>
                        {/* Denominator of the per-post averages. Without it,
                            "Post 7" next to "Views/post 177,3" for 532 views
                            reads as arithmetic that doesn't add up -- the gap
                            is posts published after the last daily sync. */}
                        <TableCell className="text-right text-muted-foreground"
                          title="Post yang metriknya sudah tersinkron — ini pembagi kolom per-post">
                          {r.rows.length || "—"}
                        </TableCell>
                        {columns.map((c) => (
                          <TableCell key={c.key} className="text-right">
                            <MetricCell rows={r.rows} platform={r.platform} column={c} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                &ldquo;—&rdquo; platform tidak melaporkan metrik itu &middot; &ldquo;·&rdquo; belum ada metrik tersinkron.
                Kolom <strong>Gagal</strong> berarti post tidak pernah terbit — beda dengan terbit tapi nol views.
              </p>
            </CardContent>
          </Card>

          {/* Global rollup, same columns as above by construction. */}
          <Card>
            <CardHeader><CardTitle>Ringkasan per Platform</CardTitle></CardHeader>
            <CardContent>
              {byPlatform.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Belum ada metrik untuk filter ini.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Post</TableHead>
                        {columns.map((c) => <TableHead key={c.key} className="text-right">{c.label}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byPlatform.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{PLATFORM_LABELS[p.name] ?? p.name}</TableCell>
                          <TableCell className="text-right">{new Set(p.rows.map((r) => r.post_id)).size}</TableCell>
                          {columns.map((c) => (
                            <TableCell key={c.key} className="text-right">
                              <MetricCell rows={p.rows} platform={p.name} column={c} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                <span>Detail per Video</span>
                <Select value={videoSort} onValueChange={setVideoSort}>
                  <SelectTrigger className="w-[190px] h-8 text-sm">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.label} tertinggi</SelectItem>)}
                    <SelectItem value="engagement">Interaksi terbanyak</SelectItem>
                    <SelectItem value="posted_at">Terbaru</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedVideos.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4" />
                  <p>Belum ada metrik untuk filter ini.</p>
                  <p className="text-sm mt-1">Metrik muncul setelah post terbit dan cron <code className="text-xs">sync-metrics</code> berjalan.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Video</TableHead>
                        <TableHead>Akun</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Terbit</TableHead>
                        {columns.map((c) => <TableHead key={c.key} className="text-right">{c.label}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedVideos.map((r) => (
                        <TableRow key={`${r.post_id}-${r.platform}`}>
                          <TableCell className="max-w-[320px]">
                            <div className="truncate" title={r.video_caption ?? undefined}>
                              {r.video_caption?.trim() || <span className="text-muted-foreground">(tanpa caption)</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.video_category}{r.video_subcategory ? ` · ${r.video_subcategory}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{r.account_label}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{PLATFORM_LABELS[r.platform] ?? r.platform}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {r.posted_at ? new Date(r.posted_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          {columns.map((c) => (
                            <TableCell key={c.key} className="text-right">
                              <MetricCell rows={[r]} platform={r.platform} column={c} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <CreativePerformanceCard />
        </>
      )}
    </div>
  );
}
