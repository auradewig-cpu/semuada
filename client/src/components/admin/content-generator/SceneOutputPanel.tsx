import { useState } from 'react';
import { Captions, Copy, Download, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
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
  type LanguageTone,
  type NarrationMode,
  type CameraPattern,
  type NarratorVoice,
  type SceneInput,
} from "@/hooks/useContentGenerator";
import { ReferenceFrameGuide } from "@/components/admin/content-generator/ReferenceFrameGuide";
import { VideoUploadPanel } from "@/components/admin/content-generator/VideoUploadPanel";

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
  languageTone: LanguageTone;
  includePrice: boolean;
  narrationMode: NarrationMode;
  cameraPattern: CameraPattern;
  // Global per video -- no per-scene override, so unlike narrationMode/
  // cameraPattern it is passed straight through to regenerate/hook-variants.
  narratorVoice: NarratorVoice;
}

interface SceneOutputPanelProps {
  result: GenerationResult;
  onResultChange: (result: GenerationResult) => void;
  warnings: string[];
  onWarningsChange: (warnings: string[]) => void;
  context: SceneGenerationContext;
  // Scene plan used at generate time -- carries the per-scene narration/camera
  // overrides so Regenerate/Hook Variants reuse the SAME effective mode as the
  // original generate, instead of silently falling back to the global default.
  scenePlan: SceneInput[];
  affiliateUrl: string | null;
  productCategory: string;
  productSubcategory: string | null;
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

export function SceneOutputPanel({ result, onResultChange, warnings, onWarningsChange, context, scenePlan, affiliateUrl, productCategory, productSubcategory }: SceneOutputPanelProps) {
  const { toast } = useToast();
  const regenerateScene = useRegenerateScene();
  const hookVariants = useHookVariants();
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [variants, setVariants] = useState<SceneOutput[] | null>(null);

  // Effective per-scene mode: the scene's own override wins, global is the
  // fallback -- mirrors how compileMasterPrompt resolved it at generate time.
  const effectiveNarrationMode = (index: number): NarrationMode =>
    scenePlan[index]?.narrationMode ?? context.narrationMode;
  const effectiveCameraPattern = (index: number): CameraPattern =>
    scenePlan[index]?.cameraPattern ?? context.cameraPattern;

  // The promise was previously neither awaited nor caught, so a denied
  // clipboard permission (or a non-secure context) showed a confident
  // "Disalin" toast with an empty clipboard.
  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Disalin", description: `${label} disalin ke clipboard.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin", description: "Browser menolak akses clipboard. Salin manual dari teks di bawah." });
    }
  };

  // Same concatenation the video library already receives -- surfaced as a
  // button so a 10-scene result doesn't need 10 separate copy round-trips.
  const allPromptsText = result.scenes
    .map((s) => `Scene ${s.scene_number} (${s.duration_seconds}s):\n${s.ai_ready_prompt}${s.negative_prompt ? `\nNegative: ${s.negative_prompt}` : ""}`)
    .join("\n\n");

  const replaceScene = (index: number, scene: SceneOutput) => {
    const nextScenes = [...result.scenes];
    nextScenes[index] = scene;
    onResultChange({ ...result, scenes: nextScenes });
    // Hook variants are derived from the scene 1 that existed when they were
    // generated. Leaving them on screen after that scene is replaced lets the
    // user pick a "variant" built from a scene that no longer exists, silently
    // discarding the regeneration they just paid for.
    setVariants(null);
  };

  const handleRegenerate = (index: number) => {
    const scene = result.scenes[index];
    setRegeneratingIndex(index);
    regenerateScene.mutate(
      {
        ...context,
        narrationMode: effectiveNarrationMode(index),
        cameraPattern: effectiveCameraPattern(index),
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
          // The regenerate route returns its own warnings, which used to be
          // dropped entirely -- so the warning card kept showing complaints
          // about the scene that was just replaced, and any NEW problem in the
          // regenerated scene was never shown at all.
          onWarningsChange(
            warnings
              .filter((w) => !w.startsWith(`Scene ${index + 1}:`) && !w.includes(`Scene ${index + 1} (`))
              .concat(data.warnings.map((w) => (w.startsWith("Scene") || w.startsWith("POLICY") ? w : `Scene ${index + 1}: ${w}`)))
          );
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
        contentGoal: context.contentGoal,
        languageTone: context.languageTone,
        sceneDuration: scene.duration_seconds,
        productImageUrl: scene.reference_images.product,
        currentScene: scene,
        includePrice: context.includePrice,
        narrationMode: effectiveNarrationMode(0),
        cameraPattern: effectiveCameraPattern(0),
        narratorVoice: context.narratorVoice,
      },
      {
        onSuccess: (data) => {
          setVariants(data.variants);
          if (data.warnings?.length) {
            toast({
              title: `Varian dibuat dengan ${data.warnings.length} peringatan`,
              description: data.warnings.slice(0, 3).join(" | "),
            });
          }
        },
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
      <ReferenceFrameGuide aiTool={context.aiTool} />

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => copyText(allPromptsText, `Semua prompt (${result.scenes.length} scene)`)}
        >
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy Semua Prompt ({result.scenes.length})
        </Button>
      </div>

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
            {scene.text_overlay && (
              <p className="bg-muted rounded px-2 py-1 inline-flex items-center gap-1.5 text-xs font-medium">
                <Captions className="h-3.5 w-3.5 shrink-0" /> Text overlay (burn-in): "{scene.text_overlay}"
              </p>
            )}
            {/* Only produced for tools with a dedicated negative-prompt input
                (Kling, Runway) -- see aiTools.ts supportsNegativePrompt. */}
            {scene.negative_prompt && (
              <div className="flex items-start justify-between gap-2 border rounded px-2 py-1.5">
                <p className="text-xs">
                  <span className="font-medium">Negative prompt:</span> {scene.negative_prompt}
                </p>
                <Button size="sm" variant="ghost" className="shrink-0 h-6 px-2" onClick={() => copyText(scene.negative_prompt!, `Negative prompt scene ${scene.scene_number}`)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

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
            <p className="text-xs text-muted-foreground break-all pt-2 border-t">
              <span className="font-medium">Link Affiliate:</span> {affiliateUrl}
            </p>
          )}
        </CardContent>
      </Card>

      <VideoUploadPanel
        productId={context.productId}
        category={productCategory}
        subcategory={productSubcategory}
        caption={result.caption}
        hashtags={result.hashtags}
        promptSnapshot={result.scenes.map((s) => `Scene ${s.scene_number}:\n${s.ai_ready_prompt}`).join('\n\n')}
      />
    </div>
  );
}
