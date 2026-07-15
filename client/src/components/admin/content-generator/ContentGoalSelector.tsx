import { Card, CardContent } from "@/components/ui/card";
import type { ContentGoal } from "@/hooks/useContentGenerator";

const GOALS: { id: ContentGoal; label: string; description: string }[] = [
  { id: 'conversion', label: 'Konversi', description: 'Jualan / direct-response, CTA sesuai gaya konten.' },
  { id: 'growth', label: 'Growth Akun', description: 'Kejar follow/save/share -- NOL bahasa jualan.' },
  { id: 'engagement', label: 'Engagement', description: 'Pancing komentar & interaksi.' },
];

interface ContentGoalSelectorProps {
  value: ContentGoal;
  onChange: (value: ContentGoal) => void;
}

export function ContentGoalSelector({ value, onChange }: ContentGoalSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {GOALS.map((goal) => (
        <Card
          key={goal.id}
          className={`cursor-pointer transition-colors ${value === goal.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(goal.id)}
        >
          <CardContent className="p-3">
            <p className="text-sm font-medium">{goal.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
