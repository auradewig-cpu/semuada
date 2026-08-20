import { Card, CardContent } from "@/components/ui/card";
import type { LanguageTone } from "@/hooks/useContentGenerator";

const TONES: { id: LanguageTone; label: string; blurb: string }[] = [
  { id: 'auto', label: 'Auto (Pilihkan)', blurb: 'Creative Director memilihkan nada bicara.' },
  { id: 'formal_netral', label: 'Formal/Netral', blurb: 'Bahasa baku namun ramah -- baseline.' },
  { id: 'santai_ngobrol', label: 'Santai/Ngobrol', blurb: 'Kayak ngobrol sama temen deket.' },
  { id: 'gaul_kekinian', label: 'Gaul/Kekinian', blurb: 'Slang anak muda Indonesia 2026.' },
  { id: 'elegan_premium', label: 'Elegan/Premium', blurb: 'Halus, tenang, kesan mewah.' },
  { id: 'heboh_lebay', label: 'Heboh/Lebay', blurb: 'Reaksi berlebihan penuh semangat.' },
  { id: 'kocak_receh', label: 'Kocak/Receh', blurb: 'Humor ringan, self-deprecating jokes.' },
  { id: 'sotoy_santai', label: 'Sotoy Santai', blurb: '"Temen yang paham banget", tanpa menggurui.' },
  { id: 'curhat_personal', label: 'Curhat/Personal', blurb: 'Nada vulnerable, cerita pribadi.' },
  { id: 'sarkas_julid', label: 'Sarkas/Julid Dikit', blurb: 'Nyeletuk jenaka, sindiran ringan.' },
  { id: 'ibu_bapack_relatable', label: 'Ibu-ibu/Bapack Relatable', blurb: 'Nada obrolan sesama orang tua.' },
];

interface LanguageToneSelectorProps {
  value: LanguageTone;
  onChange: (value: LanguageTone) => void;
}

export function LanguageToneSelector({ value, onChange }: LanguageToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {TONES.map((tone) => (
        <Card
          key={tone.id}
          className={`cursor-pointer transition-colors ${value === tone.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(tone.id)}
        >
          <CardContent className="p-3">
            <p className="text-sm font-medium">{tone.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{tone.blurb}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
