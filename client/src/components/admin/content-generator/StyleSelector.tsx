import { Card, CardContent } from "@/components/ui/card";
import type { ContentStyleId } from "@/hooks/useContentGenerator";

const STYLES: { id: ContentStyleId; label: string; description: string }[] = [
  { id: 'direct_response', label: 'Direct Response / Iklan', description: 'Hook -> Body -> CTA keras. Klasik untuk affiliate.' },
  { id: 'vlog_daily', label: 'Vlog / Day-in-Life', description: 'Cerita personal natural, tanpa hard-sell.' },
  { id: 'tutorial_howto', label: 'Tutorial / How-To', description: 'Ajarkan 1 skill/cara spesifik, langkah bernomor.' },
  { id: 'storytime', label: 'Storytime', description: 'Cerita spesifik membangun ketegangan ke payoff.' },
  { id: 'listicle_countdown', label: 'Listicle / Countdown', description: 'Format "Top N hal", 1 scene = 1 poin.' },
  { id: 'before_after', label: 'Before/After', description: 'Kondisi awal, proses, reveal hasil dramatis.' },
  { id: 'pattern_break_twist', label: 'Pattern-Break / Twist', description: 'Terlihat 1 genre, tengah berubah tak terduga.' },
  { id: 'series_episodic', label: 'Series / Episodic', description: 'Bagian dari seri, sengaja menggantung di akhir.' },
];

interface StyleSelectorProps {
  value: ContentStyleId;
  onChange: (value: ContentStyleId) => void;
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {STYLES.map((style) => (
        <Card
          key={style.id}
          className={`cursor-pointer transition-colors ${value === style.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(style.id)}
        >
          <CardContent className="p-4">
            <p className="text-sm font-medium">{style.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{style.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
