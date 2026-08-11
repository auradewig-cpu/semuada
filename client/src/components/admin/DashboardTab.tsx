import { useMemo, useState } from "react";
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

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  threads: "Threads",
  facebook_page: "Facebook Page",
};

// Which columns each provider actually reports. Anything outside its list
// arrives as NULL forever, so a per-platform view renders "—" instead of a 0
// that would read as "nobody saved this" rather than "this can't be measured".
const PLATFORM_COVERAGE: Record<string, string[]> = {
  tiktok: ["views", "reach", "reactions", "comments", "shares"],
  instagram: ["views", "reach", "reactions", "comments", "shares", "saves", "follows"],
  youtube: ["views", "reactions", "comments"],
  threads: ["views", "impressions", "reach", "reactions", "comments", "shares", "saves", "clicks", "follows"],
  facebook_page: ["views", "impressions", "reach", "reactions", "comments", "shares", "saves", "clicks", "follows"],
};

type SortKey = "posted_at" | "views" | "engagement" | "engagement_rate";

/** Sum that stays null when nothing in the group reported the metric at all. */
function sumOrNull(rows: SocialMetricRow[], key: keyof SocialMetricRow): number | null {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    const value = row[key];
    if (typeof value === "number") {
      total += value;
      seen = true;
    }
  }
  return seen ? total : null;
}

/** Reactions + comments + shares + saves -- the interactions, minus passive views. */
function engagementOf(row: SocialMetricRow): number {
  return (row.reactions ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0);
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("id-ID");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof Eye;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardTab() {
  const [period, setPeriod] = useState<MetricsPeriod>("all");
  const [category, setCategory] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const { data, isLoading, isFetching, refetch } = useSchedulerMetrics(period);

  const allRows = useMemo(() => data?.items ?? [], [data]);
  const allAccounts = useMemo(() => data?.accounts ?? [], [data]);

  // Categories come from the ACCOUNT list, not from the metric rows: a
  // category whose accounts haven't been synced yet must still be listed.
  const categories = useMemo(
    () => Array.from(new Set(allAccounts.map((a) => a.category))).sort(),
    [allAccounts]
  );
  const platforms = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.platform))).sort(),
    [allRows]
  );

  const rows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (category === "all" || r.category === category) &&
          (platform === "all" || r.platform === platform)
      ),
    [allRows, category, platform]
  );

  const accounts = useMemo(
    () => allAccounts.filter((a) => category === "all" || a.category === category),
    [allAccounts, category]
  );

  const totals = useMemo(
    () => ({
      views: sumOrNull(rows, "views"),
      engagement: rows.reduce((sum, r) => sum + engagementOf(r), 0),
      posts: new Set(rows.map((r) => r.post_id)).size,
      videos: new Set(rows.map((r) => r.video_id)).size,
      accounts: accounts.length,
      accountsWithData: new Set(rows.map((r) => r.account_id)).size,
    }),
    [rows, accounts]
  );

  // Category -> account, built from the ACCOUNT list so every account shows up
  // even with no metrics attached. Several accounts share one category (see
  // scheduler_accounts.category), which is the grouping the user thinks in.
  const byCategory = useMemo(() => {
    const rowsByAccount = new Map<string, SocialMetricRow[]>();
    for (const row of rows) {
      if (!rowsByAccount.has(row.account_id)) rowsByAccount.set(row.account_id, []);
      rowsByAccount.get(row.account_id)!.push(row);
    }

    const grouped = new Map<string, SocialAccount[]>();
    for (const account of accounts) {
      if (!grouped.has(account.category)) grouped.set(account.category, []);
      grouped.get(account.category)!.push(account);
    }

    return Array.from(grouped.entries())
      .map(([name, categoryAccounts]) => {
        const withRows = categoryAccounts
          .map((account) => ({ account, rows: rowsByAccount.get(account.id) ?? [] }))
          .sort((a, b) => (sumOrNull(b.rows, "views") ?? 0) - (sumOrNull(a.rows, "views") ?? 0));
        return { name, accounts: withRows, rows: withRows.flatMap((a) => a.rows) };
      })
      .sort((a, b) => (sumOrNull(b.rows, "views") ?? 0) - (sumOrNull(a.rows, "views") ?? 0));
  }, [rows, accounts]);

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

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "posted_at") {
        return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
      }
      if (sortKey === "engagement") return engagementOf(b) - engagementOf(a);
      if (sortKey === "engagement_rate") return (b.engagement_rate ?? -1) - (a.engagement_rate ?? -1);
      return (b.views ?? -1) - (a.views ?? -1);
    });
    return copy;
  }, [rows, sortKey]);

  const coverage = data?.coverage;
  const thinHistory = (coverage?.distinct_days ?? 0) < 7;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as MetricsPeriod)}
            aria-label="Rentang waktu"
          >
            <ToggleGroupItem value="7d" aria-label="7 hari terakhir">7H</ToggleGroupItem>
            <ToggleGroupItem value="30d" aria-label="30 hari terakhir">30H</ToggleGroupItem>
            <ToggleGroupItem value="90d" aria-label="90 hari terakhir">90H</ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="Semua waktu">Semua</ToggleGroupItem>
          </ToggleGroup>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua platform</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
                {coverage.first_captured_on && coverage.last_captured_on && (
                  <> ({coverage.first_captured_on} s/d {coverage.last_captured_on})</>
                )}
                . Angka di bawah adalah snapshot <strong className="text-foreground">terbaru</strong> tiap post, bukan penjumlahan antar-hari.
                {thinHistory && " Terlalu dini untuk membandingkan performa antar-video — butuh sekitar 2 minggu agar 'bagus' dan 'jelek' punya pembanding yang adil."}
              </>
            )}
          </p>
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Views" value={fmt(totals.views)} icon={Eye} loading={isLoading}
          hint={`${totals.videos} video`} />
        <StatCard title="Total Interaksi" value={fmt(totals.engagement)} icon={Heart} loading={isLoading}
          hint="like + komentar + share + save" />
        <StatCard title="Post Terbit" value={fmt(totals.posts)} icon={BarChart3} loading={isLoading}
          hint={`${rows.length} baris post x platform`} />
        <StatCard title="Akun" value={fmt(totals.accounts)} icon={Users} loading={isLoading}
          hint={`${totals.accountsWithData} sudah ada metrik · ${categories.length} kategori`} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Per kategori -> per akun. Rendered even with zero metrics: the
              account list itself answers "which accounts exist and are any of
              them silent?", which is half the question this tab is for. */}
          <Card>
            <CardHeader>
              <CardTitle>Performa per Kategori &amp; Akun</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {byCategory.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-border">
                    <h4 className="font-semibold">{cat.name}</h4>
                    <span className="text-sm text-muted-foreground">
                      {fmt(sumOrNull(cat.rows, "views"))} views &middot;{" "}
                      {fmt(cat.rows.reduce((s, r) => s + engagementOf(r), 0))} interaksi &middot;{" "}
                      {cat.accounts.length} akun
                    </span>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Akun</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead className="text-right">Post</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                          <TableHead className="text-right">Interaksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.accounts.map(({ account, rows: accRows }) => {
                          const noData = accRows.length === 0;
                          return (
                            <TableRow key={account.id} className={noData ? "text-muted-foreground" : undefined}>
                              <TableCell className="font-medium">
                                {account.label}
                                {!account.is_active && (
                                  <span className="ml-2 text-xs text-muted-foreground">(nonaktif)</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {noData ? (
                                  // Distinguishes "posted, waiting for the daily
                                  // sync" from "hasn't posted anything yet" --
                                  // the two need different responses from you.
                                  account.posts_published > 0
                                    ? `${account.posts_published} post terbit, metrik belum tersinkron`
                                    : "belum ada post terbit"
                                ) : (
                                  Array.from(new Set(accRows.map((r) => PLATFORM_LABELS[r.platform] ?? r.platform)))
                                    .sort()
                                    .join(", ")
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {noData ? account.posts_published : new Set(accRows.map((r) => r.post_id)).size}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {noData ? "—" : fmt(sumOrNull(accRows, "views"))}
                              </TableCell>
                              <TableCell className="text-right">
                                {noData ? "—" : fmt(accRows.reduce((s, r) => s + engagementOf(r), 0))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {rows.length === 0 && (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <BarChart3 className="h-16 w-16 mx-auto mb-4" />
                <p>Belum ada metrik untuk filter ini.</p>
                <p className="text-sm mt-1">
                  Metrik baru muncul setelah post terbit dan cron <code className="text-xs">sync-metrics</code> berjalan (sekali sehari).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Per platform */}
          {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Performa per Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Post</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Like</TableHead>
                      <TableHead className="text-right">Komentar</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                      <TableHead className="text-right">Save</TableHead>
                      <TableHead className="text-right">Follow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byPlatform.map((p) => {
                      const covered = PLATFORM_COVERAGE[p.name] ?? [];
                      const cell = (key: keyof SocialMetricRow, name: string) =>
                        covered.length > 0 && !covered.includes(name) ? (
                          <span className="text-muted-foreground/50" title="Platform ini tidak melaporkan metrik tersebut">—</span>
                        ) : (
                          fmt(sumOrNull(p.rows, key))
                        );
                      return (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{PLATFORM_LABELS[p.name] ?? p.name}</TableCell>
                          <TableCell className="text-right">{new Set(p.rows.map((r) => r.post_id)).size}</TableCell>
                          <TableCell className="text-right font-semibold">{cell("views", "views")}</TableCell>
                          <TableCell className="text-right">{cell("reactions", "reactions")}</TableCell>
                          <TableCell className="text-right">{cell("comments", "comments")}</TableCell>
                          <TableCell className="text-right">{cell("shares", "shares")}</TableCell>
                          <TableCell className="text-right">{cell("saves", "saves")}</TableCell>
                          <TableCell className="text-right">{cell("follows", "follows")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                &ldquo;—&rdquo; berarti platform tersebut memang tidak melaporkan metrik itu, bukan berarti nol.
              </p>
            </CardContent>
          </Card>
          )}

          {/* Per video */}
          {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-3">
                <span>Detail per Video</span>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="w-[190px] h-8 text-sm">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Views terbanyak</SelectItem>
                    <SelectItem value="engagement">Interaksi terbanyak</SelectItem>
                    <SelectItem value="engagement_rate">Engagement rate</SelectItem>
                    <SelectItem value="posted_at">Terbaru</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Video</TableHead>
                      <TableHead>Akun</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Terbit</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Like</TableHead>
                      <TableHead className="text-right">Komentar</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                      <TableHead className="text-right">ER</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((r) => (
                      <TableRow key={`${r.post_id}-${r.platform}`}>
                        <TableCell className="max-w-[320px]">
                          <div className="truncate" title={r.video_caption ?? undefined}>
                            {r.video_caption?.trim() || <span className="text-muted-foreground">(tanpa caption)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.video_category}
                            {r.video_subcategory ? ` · ${r.video_subcategory}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.account_label}</TableCell>
                        <TableCell className="text-sm">{PLATFORM_LABELS[r.platform] ?? r.platform}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDate(r.posted_at)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(r.views)}</TableCell>
                        <TableCell className="text-right">{fmt(r.reactions)}</TableCell>
                        <TableCell className="text-right">{fmt(r.comments)}</TableCell>
                        <TableCell className="text-right">{fmt(r.shares)}</TableCell>
                        <TableCell className="text-right">
                          {r.engagement_rate === null ? "—" : `${r.engagement_rate.toFixed(2)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          )}
        </>
      )}
    </div>
  );
}
