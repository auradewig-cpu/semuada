import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SocialMetricRow } from "@/hooks/useSchedulerMetrics";
import { PLATFORM_LABELS, PLATFORM_ORDER } from "@/lib/socialMetrics";
import { bestHours, MIN_POSTS_FOR_READING, postingHourTable, type HourCell } from "@/lib/postingHours";

const scoreFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function ScoreCell({ cell }: { cell: HourCell | undefined }) {
  if (!cell || cell.n === 0 || cell.score === null) return <span className="text-muted-foreground">·</span>;
  const thin = cell.n < MIN_POSTS_FOR_READING;
  const tone = thin ? "text-muted-foreground" : cell.score >= 1.2 ? "text-green-600 font-semibold" : cell.score <= 0.8 ? "text-red-500" : "";
  return (
    <span className={tone} title={thin ? `Baru ${cell.n} post — belum cukup untuk disimpulkan` : `${cell.n} post`}>
      {scoreFormat.format(cell.score)}&times;
      <span className="ml-1 text-[10px] text-muted-foreground">{cell.n}</span>
    </span>
  );
}

// Which hour performs best, judged against each account's own normal so a
// strong account can't pass for a strong hour -- see lib/postingHours.ts.
// Follows the dashboard's period and category filters through `rows`.
export function PostingHourAnalysis({ rows }: { rows: SocialMetricRow[] }) {
  const table = useMemo(() => postingHourTable(rows), [rows]);
  const platforms = useMemo(() => {
    const present = new Set(rows.map((r) => r.platform));
    return PLATFORM_ORDER.filter((p) => present.has(p));
  }, [rows]);
  const best = useMemo(() => bestHours(table), [table]);
  const pad = (h: number) => String(h).padStart(2, "0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analisa Jam Posting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tiap post dibandingkan dengan hasil biasa <strong className="text-foreground">akunnya sendiri</strong> di platform yang sama,
          jadi akun yang kuat atau lemah tidak mengacaukan perbandingan jam. 1,0&times; = biasa, 1,5&times; = 50% lebih tinggi dari biasanya.
          Angka kecil = jumlah post; abu-abu = kurang dari {MIN_POSTS_FOR_READING} post, belum bisa disimpulkan.
        </p>
        {best.length > 0 ? (
          <p className="text-sm">
            Jam terbaik sejauh ini:{" "}
            {best.map((r, i) => (
              <span key={r.hour}>
                {i > 0 && ", "}
                <strong>{pad(r.hour)}:00</strong> ({scoreFormat.format(r.all.score as number)}&times;)
              </span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada jam dengan cukup data untuk disimpulkan.</p>
        )}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jam (WIB)</TableHead>
                <TableHead className="text-right">Semua</TableHead>
                {platforms.map((p) => (
                  <TableHead key={p} className="text-right whitespace-nowrap">{PLATFORM_LABELS[p] ?? p}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.map((r) => (
                <TableRow key={r.hour}>
                  <TableCell className="font-medium whitespace-nowrap">{pad(r.hour)}:00&ndash;{pad(r.hour)}:59</TableCell>
                  <TableCell className="text-right whitespace-nowrap"><ScoreCell cell={r.all} /></TableCell>
                  {platforms.map((p) => (
                    <TableCell key={p} className="text-right whitespace-nowrap"><ScoreCell cell={r.byPlatform[p]} /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
