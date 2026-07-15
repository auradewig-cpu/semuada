import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiToolId } from "@/hooks/useContentGenerator";

const AI_TOOLS: { id: AiToolId; label: string; charLimit: number }[] = [
  { id: 'google_flow', label: 'Google Flow', charLimit: 500 },
  { id: 'veo3', label: 'Google Veo 3', charLimit: 500 },
  { id: 'kling_ai', label: 'Kling AI 2.0', charLimit: 400 },
  { id: 'runway_gen4', label: 'Runway Gen-4', charLimit: 300 },
  { id: 'luma_dream', label: 'Luma Dream Machine', charLimit: 300 },
  { id: 'pika_labs', label: 'Pika Labs 2.0', charLimit: 250 },
  { id: 'sora', label: 'OpenAI Sora', charLimit: 600 },
];

interface AiToolSelectorProps {
  value: AiToolId;
  onChange: (value: AiToolId) => void;
}

export function AiToolSelector({ value, onChange }: AiToolSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AiToolId)}>
      <SelectTrigger>
        <SelectValue placeholder="Pilih AI video tool" />
      </SelectTrigger>
      <SelectContent>
        {AI_TOOLS.map((tool) => (
          <SelectItem key={tool.id} value={tool.id}>
            {tool.label} (maks {tool.charLimit} karakter)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
