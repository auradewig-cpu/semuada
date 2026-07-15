import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QUICK_PICKS = [5, 8, 10];

// Non-blocking nudges, not hard limits -- most short-form platforms perform
// best under these thresholds, but nothing stops the user from ignoring them.
const MAX_RECOMMENDED_SCENE_SECONDS = 20;
const MAX_RECOMMENDED_TOTAL_SECONDS = 90;

function getDurationWarnings(sceneDurations: number[]): string[] {
  const warnings: string[] = [];
  const total = sceneDurations.reduce((a, b) => a + b, 0);

  sceneDurations.forEach((d, i) => {
    if (d > MAX_RECOMMENDED_SCENE_SECONDS) {
      warnings.push(`Scene ${i + 1} (${d}s) cukup panjang -- scene di atas ${MAX_RECOMMENDED_SCENE_SECONDS}s berisiko bikin penonton bosan sebelum cut berikutnya.`);
    }
  });

  if (total > MAX_RECOMMENDED_TOTAL_SECONDS) {
    warnings.push(`Total durasi ${total}s cukup panjang -- kebanyakan platform video pendek optimal di bawah ${MAX_RECOMMENDED_TOTAL_SECONDS}s untuk completion rate terbaik.`);
  }

  return warnings;
}

interface ScenePlannerProps {
  sceneDurations: number[];
  onChange: (durations: number[]) => void;
}

export function ScenePlanner({ sceneDurations, onChange }: ScenePlannerProps) {
  const setDuration = (index: number, value: number) => {
    const next = [...sceneDurations];
    next[index] = value;
    onChange(next);
  };

  const applyToAll = (value: number) => {
    onChange(sceneDurations.map(() => value));
  };

  const warnings = getDurationWarnings(sceneDurations);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Terapkan ke semua scene:</span>
        {QUICK_PICKS.map((s) => (
          <Button key={s} type="button" size="sm" variant="outline" onClick={() => applyToAll(s)}>
            {s}s
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {sceneDurations.map((duration, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-sm font-medium w-20">Scene {index + 1}</span>
            <Input
              type="number"
              min={2}
              max={60}
              value={duration}
              onChange={(e) => setDuration(index, Number(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">detik</span>
            {index === 0 && (
              <span className="text-xs text-amber-600 font-medium">Hook Window 3-5s pertama (terkunci di dalam durasi ini)</span>
            )}
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="text-xs space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-amber-600">
              <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
