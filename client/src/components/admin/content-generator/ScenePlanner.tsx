import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QUICK_PICKS = [5, 8, 10];

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
    </div>
  );
}
