import { Card, CardContent } from "@/components/ui/card";
import type { HookArchetype } from "@/hooks/useContentGenerator";

const ARCHETYPES: { id: HookArchetype; label: string; blurb: string }[] = [
  { id: 'unpopular_opinion', label: 'Unpopular Opinion', blurb: 'Buka dengan pendapat berlawanan dari anggapan umum.' },
  { id: 'pov_realism', label: 'POV Realism', blurb: 'Sudut pandang orang pertama yang sangat relatable.' },
  { id: 'specific_outcome', label: 'Specific Outcome', blurb: 'Angka/hasil konkret di awal, bukan klaim generik.' },
  { id: 'curiosity_gap', label: 'Curiosity Gap', blurb: 'Info sengaja belum lengkap, memancing rasa penasaran.' },
  { id: 'relatable', label: 'Relatable', blurb: 'Situasi/kebiasaan sehari-hari yang langsung terasa related.' },
  { id: 'emotional', label: 'Emotional', blurb: 'Momen yang menyentuh emosi spesifik.' },
];

interface HookArchetypeSelectorProps {
  value: HookArchetype;
  onChange: (value: HookArchetype) => void;
}

export function HookArchetypeSelector({ value, onChange }: HookArchetypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {ARCHETYPES.map((archetype) => (
        <Card
          key={archetype.id}
          className={`cursor-pointer transition-colors ${value === archetype.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(archetype.id)}
        >
          <CardContent className="p-3">
            <p className="text-sm font-medium">{archetype.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{archetype.blurb}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
