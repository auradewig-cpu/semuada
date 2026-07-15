import { Copy, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { GenerationResult } from "@/hooks/useContentGenerator";

interface SceneOutputPanelProps {
  result: GenerationResult;
}

async function downloadAs(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export function SceneOutputPanel({ result }: SceneOutputPanelProps) {
  const { toast } = useToast();

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin", description: `${label} disalin ke clipboard.` });
  };

  return (
    <div className="space-y-4">
      {result.scenes.map((scene) => (
        <Card key={scene.scene_number}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Scene {scene.scene_number}</span>
              <Button size="sm" variant="outline" onClick={() => copyText(scene.ai_ready_prompt, `Prompt scene ${scene.scene_number}`)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy Prompt
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="font-medium">Narasi:</span> {scene.script_narration}</p>
            <p className="text-xs text-muted-foreground">{scene.script_word_count} kata &middot; {scene.speech_pace} &middot; {scene.duration_seconds}s</p>
            <p><span className="font-medium">Kamera:</span> {scene.camera_direction}</p>

            <div className="flex flex-wrap gap-2">
              {scene.reference_images.character && (
                <Button size="sm" variant="secondary" onClick={() => downloadAs(scene.reference_images.character!, scene.reference_images.character_filename!)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> {scene.reference_images.character_filename}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => downloadAs(scene.reference_images.product, scene.reference_images.product_filename)}>
                <Download className="h-3.5 w-3.5 mr-1" /> {scene.reference_images.product_filename}
              </Button>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">AI-ready prompt (lihat teks lengkap)</summary>
              <p className="mt-2 whitespace-pre-wrap bg-muted rounded p-2">{scene.ai_ready_prompt}</p>
            </details>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Caption &amp; Hashtag</span>
            <Button size="sm" variant="outline" onClick={() => copyText(`${result.caption}\n\n${result.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')}`, 'Caption + hashtag')}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{result.caption}</p>
          <p className="text-primary">{result.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
