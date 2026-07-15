import { Card, CardContent } from "@/components/ui/card";

export type ContentStyleId = 'vlog' | 'content_creator' | 'faceless_pov';

const STYLES: { id: ContentStyleId; label: string; description: string }[] = [
  { id: 'vlog', label: 'Vlog / Ngeflog', description: 'Kamera handheld, nada santai seperti cerita ke teman.' },
  { id: 'content_creator', label: 'Content Creator', description: 'Kamera stabil, energi tinggi di awal, persuasif.' },
  { id: 'faceless_pov', label: 'Faceless POV Tangan', description: 'Tanpa wajah talent, fokus interaksi tangan + voiceover.' },
];

interface StyleSelectorProps {
  value: ContentStyleId;
  onChange: (value: ContentStyleId) => void;
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
