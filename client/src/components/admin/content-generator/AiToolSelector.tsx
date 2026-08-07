import { TriangleAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiToolId } from "@/hooks/useContentGenerator";

// Mirrors lib/content-generator/aiTools.ts. supportsRef and maxDuration were
// already defined server-side but never surfaced -- so a user could pick Sora
// with a character and only learn the character photo is unusable AFTER paying
// for a generate, and could set a 20s scene for a tool that caps at 5s.
const AI_TOOLS: { id: AiToolId; label: string; charLimit: number; maxDuration: number; supportsRef: boolean }[] = [
  { id: 'google_flow', label: 'Google Flow', charLimit: 500, maxDuration: 8, supportsRef: true },
  { id: 'veo3', label: 'Google Veo 3', charLimit: 500, maxDuration: 8, supportsRef: true },
  { id: 'kling_ai', label: 'Kling AI 2.0', charLimit: 400, maxDuration: 10, supportsRef: true },
  { id: 'runway_gen4', label: 'Runway Gen-4', charLimit: 300, maxDuration: 10, supportsRef: true },
  { id: 'luma_dream', label: 'Luma Dream Machine', charLimit: 300, maxDuration: 9, supportsRef: true },
  { id: 'pika_labs', label: 'Pika Labs 2.0', charLimit: 250, maxDuration: 5, supportsRef: true },
  { id: 'sora', label: 'OpenAI Sora', charLimit: 600, maxDuration: 20, supportsRef: false },
];

interface AiToolSelectorProps {
  value: AiToolId;
  onChange: (value: AiToolId) => void;
  // Used only to warn when the selected tool can't accept the character
  // reference photo the user already picked.
  hasCharacter: boolean;
}

export function AiToolSelector({ value, onChange, hasCharacter }: AiToolSelectorProps) {
  const selected = AI_TOOLS.find((t) => t.id === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={(v) => onChange(v as AiToolId)}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih AI video tool" />
        </SelectTrigger>
        <SelectContent>
          {AI_TOOLS.map((tool) => (
            <SelectItem key={tool.id} value={tool.id}>
              {tool.label} (maks {tool.charLimit} karakter &middot; klip ~{tool.maxDuration}s)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Satu scene di {selected.label} maksimal sekitar {selected.maxDuration} detik per generate.
        </p>
      )}

      {selected && !selected.supportsRef && hasCharacter && (
        <p className="text-xs text-amber-600 flex items-start gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {selected.label} tidak mendukung foto referensi karakter -- foto karakter yang kamu pilih kemungkinan besar tidak bisa dipakai di tool ini.
        </p>
      )}
    </div>
  );
}
