import { Button } from "@/components/ui/button";
import type { AspectRatio } from "@/hooks/useContentGenerator";

const RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '9:16', label: '9:16 Vertikal' },
  { id: '16:9', label: '16:9 Landscape' },
  { id: '1:1', label: '1:1 Square' },
  { id: '4:5', label: '4:5 Portrait' },
  { id: '3:4', label: '3:4 Portrait' },
];

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (value: AspectRatio) => void;
}

export function AspectRatioSelector({ value, onChange }: AspectRatioSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {RATIOS.map((ratio) => (
        <Button
          key={ratio.id}
          type="button"
          size="sm"
          variant={value === ratio.id ? 'default' : 'outline'}
          onClick={() => onChange(ratio.id)}
        >
          {ratio.label}
        </Button>
      ))}
    </div>
  );
}
