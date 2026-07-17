import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SceneInput, NarrationMode, CameraPattern } from "@/hooks/useContentGenerator";

const QUICK_PICKS = [5, 6, 8, 10];

// Non-blocking nudges, not hard limits -- most short-form platforms perform
// best under these thresholds, but nothing stops the user from ignoring them.
const MAX_RECOMMENDED_SCENE_SECONDS = 20;
const MAX_RECOMMENDED_TOTAL_SECONDS = 90;

function getDurationWarnings(scenes: SceneInput[]): string[] {
  const warnings: string[] = [];
  const total = scenes.reduce((a, s) => a + s.duration, 0);

  scenes.forEach((s, i) => {
    if (s.duration > MAX_RECOMMENDED_SCENE_SECONDS) {
      warnings.push(`Scene ${i + 1} (${s.duration}s) cukup panjang -- scene di atas ${MAX_RECOMMENDED_SCENE_SECONDS}s berisiko bikin penonton bosan sebelum cut berikutnya.`);
    }
  });

  if (total > MAX_RECOMMENDED_TOTAL_SECONDS) {
    warnings.push(`Total durasi ${total}s cukup panjang -- kebanyakan platform video pendek optimal di bawah ${MAX_RECOMMENDED_TOTAL_SECONDS}s untuk completion rate terbaik.`);
  }

  return warnings;
}

interface ScenePlannerProps {
  scenes: SceneInput[];
  onChange: (scenes: SceneInput[]) => void;
}

export function ScenePlanner({ scenes, onChange }: ScenePlannerProps) {
  const updateScene = (index: number, patch: Partial<SceneInput>) => {
    const next = [...scenes];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeScene = (index: number) => {
    onChange(scenes.filter((_, i) => i !== index));
  };

  const applyDurationToAll = (value: number) => {
    onChange(scenes.map((s) => ({ ...s, duration: value })));
  };

  const warnings = getDurationWarnings(scenes);

  if (scenes.length === 0) {
    return <p className="text-sm text-muted-foreground">Klik foto produk di atas untuk menambahkan scene.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Durasi semua scene:</span>
        {QUICK_PICKS.map((s) => (
          <Button key={s} type="button" size="sm" variant="outline" onClick={() => applyDurationToAll(s)}>
            {s}s
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {scenes.map((scene, index) => (
          <div key={index} className="flex flex-wrap items-center gap-3 border rounded-lg p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scene.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
            <span className="text-sm font-medium w-16">Scene {index + 1}</span>

            <Input
              type="number"
              min={2}
              max={60}
              value={scene.duration}
              onChange={(e) => updateScene(index, { duration: Number(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground -ml-2">detik</span>

            <select
              className="text-xs border rounded px-2 py-1.5 bg-background"
              value={scene.narrationMode ?? ''}
              onChange={(e) => updateScene(index, { narrationMode: (e.target.value || null) as NarrationMode | null })}
            >
              <option value="">Narasi: ikuti global</option>
              <option value="lipsync">Narasi: Lipsync</option>
              <option value="voiceover">Narasi: Voiceover</option>
            </select>

            <select
              className="text-xs border rounded px-2 py-1.5 bg-background"
              value={scene.cameraPattern ?? ''}
              onChange={(e) => updateScene(index, { cameraPattern: (e.target.value || null) as CameraPattern | null })}
            >
              <option value="">Kamera: ikuti global</option>
              <option value="single_angle">Kamera: Single Angle</option>
              <option value="aroll_broll">Kamera: A-Roll/B-Roll</option>
            </select>

            {index === 0 && (
              <span className="text-xs text-amber-600 font-medium">Hook Window 3-5s pertama</span>
            )}

            <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeScene(index)}>
              <X className="h-4 w-4" />
            </Button>
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
