import { Card, CardContent } from "@/components/ui/card";
import type { CameraPattern } from "@/hooks/useContentGenerator";

const PATTERNS: { id: CameraPattern; label: string; description: string }[] = [
  { id: 'single_angle', label: 'Single Angle', description: 'Fokus konsisten satu angle/subjek per scene, tanpa cutaway bergantian.' },
  { id: 'aroll_broll', label: 'A-Roll / B-Roll', description: 'Selang-seling shot karakter (A-roll) dengan cutaway close-up produk (B-roll) dalam scene.' },
];

interface CameraPatternSelectorProps {
  value: CameraPattern;
  onChange: (value: CameraPattern) => void;
}

export function CameraPatternSelector({ value, onChange }: CameraPatternSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PATTERNS.map((pattern) => (
        <Card
          key={pattern.id}
          className={`cursor-pointer transition-colors ${value === pattern.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(pattern.id)}
        >
          <CardContent className="p-3">
            <p className="text-sm font-medium">{pattern.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
