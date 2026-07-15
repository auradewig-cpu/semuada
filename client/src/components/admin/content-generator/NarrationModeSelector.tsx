import { Card, CardContent } from "@/components/ui/card";
import type { NarrationMode } from "@/hooks/useContentGenerator";

const MODES: { id: NarrationMode; label: string; description: string }[] = [
  { id: 'lipsync', label: 'Lipsync (Karakter Bicara)', description: 'Karakter bicara sinkron dengan narasi, mulut bergerak mengucapkan kata.' },
  { id: 'voiceover', label: 'Voiceover (VO Demo)', description: 'Karakter beraktivitas/memperagakan produk diam-diam, audio murni voiceover di atas visual.' },
];

interface NarrationModeSelectorProps {
  value: NarrationMode;
  onChange: (value: NarrationMode) => void;
}

export function NarrationModeSelector({ value, onChange }: NarrationModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {MODES.map((mode) => (
        <Card
          key={mode.id}
          className={`cursor-pointer transition-colors ${value === mode.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(mode.id)}
        >
          <CardContent className="p-3">
            <p className="text-sm font-medium">{mode.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
