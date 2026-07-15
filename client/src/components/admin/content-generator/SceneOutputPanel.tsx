import { useState } from 'react';
import { Copy, Download, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useRegenerateScene,
  useHookVariants,
  type GenerationResult,
  type SceneOutput,
  type ContentStyleId,
  type AiToolId,
  type PlatformTarget,
  type AspectRatio,
  type HookArchetype,
  type ContentGoal,
  type CtaTypeId,
} from "@/hooks/useContentGenerator";

export interface SceneGenerationContext {
  productId: string;
  characterId: string | null;
  style: ContentStyleId;
  aiTool: AiToolId;
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  hookArchetype: HookArchetype;
  contentGoal: ContentGoal;
  ctaType: CtaTypeId;
}

interface SceneOutputPanelProps {
  result: GenerationResult;
  onResultChange: (result: GenerationResult) => void;
  warnings: string[];
  context: SceneGenerationContext;
  affiliateUrl: string | null;
}

// Defensive cleanup for display/copy -- the prompt instructs the AI to keep
// hashtags out of the caption text, but strip any that slip through so the
// caption never shows hashtags twice (once in the text, once in the
// dedicated hashtags line below it).
function stripHashtags(text: string): string {
  return text.replace(/#\w+/g, "").replace(/\s{2,}/g, " ").trim();
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

export function SceneOutputPanel({ result, onResultChange, warnings, context, affiliateUrl }: SceneOutputPanelProps) {
  const { toast } = useToast();
  const regenerateScene = useRegenerateScene();
  const hookVariants = useHookVariants();
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [variants, setVariants] = useState<SceneOutput[] | null>(null);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin", description: `${label} disalin ke clipboard.` });
  };

  const replaceScene = (index: number, scene: SceneOutput) => {
    const nextScenes = [...result.scenes];
    nextScenes[index] = scene;
    onResultChange({ ...result, scenes: nextScenes });
  };

  const handleRegenerate = (index: number) => {
    const scene = result.scenes[index];
    setRegeneratingIndex(index);
    regenerateScene.mutate(
      {
        ...context,
        sceneIndex: index,
        sceneDuration: scene.duration_seconds,
        totalScenes: result.scenes.length,
        productImageUrl: scene.reference_images.product,
        previousScene: index > 0 ? result.scenes[index - 1] : null,
        nextScene: index < result.scenes.length - 1 ? result.scenes[index + 1] : null,
      },
      {
        onSuccess: (data) => {
          replaceScene(index, data.scene);
          toast({ title: "Scene diperbarui", description: `Scene ${index + 1} berhasil diregenerate.` });
        },
        onError: (error) => toast({ variant: "destructive", title: "Gagal regenerate", description: error.message }),
        onSettled: () => setRegeneratingIndex(null),
      }
    );
  };

  const handleHookVariants = () => {
    const scene = result.scenes[0];
    hookVariants.mutate(
      {
        productId: context.productId,
        characterId: context.characterId,
        style: context.style,
        aiTool: context.aiTool,
        platform: context.platform,
        aspectRatio: context.aspectRatio,
        currentArchetype: context.hookArchetype,
        sceneDuration: scene.duration_seconds,
        productImageUrl: scene.reference_images.product,
        currentScene: scene,
      },
      {
        onSuccess: (data) => setVariants(data.variants),
        onError: (error) => toast({ variant: "destructive", title: "Gagal generate varian", description: error.message }),
      }
    );
  };

  const pickVariant = (variant: SceneOutput) => {
    replaceScene(0, variant);
    setVariants(null);
    toast({ title: "Hook diganti", description: "Scene 1 diperbarui dengan varian terpilih." });
  };

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <Card className="border-amber-400">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <TriangleAlert className="h-4 w-4" /> Peringatan ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.scenes.map((scene, index) => (
        <Card key={scene.scene_number}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>Scene {scene.scene_number}</span>
              <div className="flex gap-2">
                {index === 0 && (
                  <Button size="sm" variant="outline" onClick={handleHookVariants} disabled={hookVariants.isPending}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> {hookVariants.isPending ? 'Generating...' : 'Varian Hook'}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleRegenerate(index)} disabled={regeneratingIndex === index}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regeneratingIndex === index ? 'animate-spin' : ''}`} />
                  {regeneratingIndex === index ? 'Regenerating...' : 'Regenerate'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyText(scene.ai_ready_prompt, `Prompt scene ${scene.scene_number}`)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Prompt
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyText(JSON.stringify(scene, null, 2), `Prompt JSON scene ${scene.scene_number}`)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Prompt JSON
                </Button>
              </div>
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

            {index === 0 && variants && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Pilih varian hook:</p>
                {variants.map((variant, vi) => (
                  <div key={vi} className="border rounded p-2 flex items-start justify-between gap-2">
                    <p className="text-xs">{variant.script_narration}</p>
                    <Button size="sm" onClick={() => pickVariant(variant)}>Pakai</Button>
                  </div>
                ))}
              </div>
            )}

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
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                copyText(
                  [
                    stripHashtags(result.caption),
                    result.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' '),
                    affiliateUrl ? `\n${affiliateUrl}` : '',
                  ].filter(Boolean).join('\n\n'),
                  'Caption + hashtag'
                )
              }
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{stripHashtags(result.caption)}</p>
          <p className="text-primary">{result.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')}</p>
          {affiliateUrl && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground break-all">
                <span className="font-medium">Link Affiliate:</span> {affiliateUrl}
              </p>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copyText(affiliateUrl, 'Link affiliate')}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
