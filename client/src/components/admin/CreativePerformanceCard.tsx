"use client";

import { useEffect, useState } from "react";
import { Sparkles, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DimensionStat {
  dimension: string;
  value: string;
  n: number;
  relativeViews: number;
  byCategory: { category: string; relativeViews: number; n: number }[];
}

interface PerformanceReport {
  untrackedVideos: number;
  trackedPosts: number;
  dimensions: { mechanism: DimensionStat[]; style: DimensionStat[]; hook: DimensionStat[]; realism: DimensionStat[] };
  recommendations: string[];
}

const MIN_TRUST = 10;

// Phase 5 (read-only) -- shows what the Content Generator's creative choices
// are actually producing, normalized per account+platform. Recommendations
// only; no actions. Low-sample rows (n < MIN_TRUST) are flagged, not served
// as fact.
export function CreativePerformanceCard() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content-generator/performance", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat performa."));
  }, []);

  if (error) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="h-4 w-4 mr-2" /> Learning (baca saja)
        </CardTitle>
        <CardDescription>
          {report
            ? `${report.trackedPosts} posting terlacak · ${report.untrackedVideos} video tanpa jejak generasi (tidak dilaporkan).`
            : "Memuat data performa..."}
        </CardDescription>
      </CardHeader>
      {report && (
        <CardContent className="space-y-4">
          {report.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada pola yang meyakinkan (perlu sampel ≥ {MIN_TRUST} per kombinasi). Rotasi "auto" sudah menangani
              monotonitas tanpa butuh data performa.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {report.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <Info className="h-4 w-4 text-emerald shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          )}

          {(["mechanism", "style", "hook", "realism"] as const).map((dim) => {
            const stats = report.dimensions[dim];
            if (stats.length === 0) return null;
            return (
              <div key={dim}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{dim}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stats.slice(0, 6).map((s) => (
                    <div key={s.value} className="border rounded-lg px-3 py-2">
                      <p className="text-sm font-medium truncate" title={s.value}>{s.value}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.relativeViews >= 0 ? `${(s.relativeViews * 100).toFixed(0)}% baseline` : "—"}
                        {s.n < MIN_TRUST ? " · sampel kecil" : ` · n=${s.n}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
