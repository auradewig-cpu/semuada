import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useGenerateContent,
  fetchHookSuggestion,
  type GenerationResult,
  type ContentStyleId,
  type AiToolId,
  type PlatformTarget,
  type AspectRatio,
  type HookArchetype,
  type ContentGoal,
  type CtaTypeId,
  type LanguageTone,
  type NarrationMode,
  type NarratorVoice,
  type CameraPattern,
  type SceneInput,
} from "@/hooks/useContentGenerator";
import { ProductPicker } from "@/components/admin/content-generator/ProductPicker";
import { ImagePicker } from "@/components/admin/content-generator/ImagePicker";
import { ScenePlanner } from "@/components/admin/content-generator/ScenePlanner";
import { CharacterPicker } from "@/components/admin/content-generator/CharacterPicker";
import { PlatformSelector, getPlatformDefaultRatio } from "@/components/admin/content-generator/PlatformSelector";
import { AspectRatioSelector } from "@/components/admin/content-generator/AspectRatioSelector";
import { AiToolSelector } from "@/components/admin/content-generator/AiToolSelector";
import { StyleSelector } from "@/components/admin/content-generator/StyleSelector";
import { ContentGoalSelector } from "@/components/admin/content-generator/ContentGoalSelector";
import { CtaTypeSelector } from "@/components/admin/content-generator/CtaTypeSelector";
import { HookArchetypeSelector } from "@/components/admin/content-generator/HookArchetypeSelector";
import { LanguageToneSelector } from "@/components/admin/content-generator/LanguageToneSelector";
import { NarrationModeSelector } from "@/components/admin/content-generator/NarrationModeSelector";
import { CameraPatternSelector } from "@/components/admin/content-generator/CameraPatternSelector";
import { SceneOutputPanel } from "@/components/admin/content-generator/SceneOutputPanel";
import type { Product } from "@/types";

export function ContentGeneratorTab() {
  const [product, setProduct] = useState<Product | null>(null);
  const [scenes, setScenes] = useState<SceneInput[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformTarget>('shopee_video');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [aiTool, setAiTool] = useState<AiToolId>('veo3');
  const [style, setStyle] = useState<ContentStyleId>('direct_response');
  const [contentGoal, setContentGoal] = useState<ContentGoal>('conversion');
  const [ctaType, setCtaType] = useState<CtaTypeId>('klik_keranjang_kuning');
  const [hookArchetype, setHookArchetype] = useState<HookArchetype>('specific_outcome');
  const [languageTone, setLanguageTone] = useState<LanguageTone>('gaul_kekinian');
  const [includePrice, setIncludePrice] = useState(true);
  const [narrationMode, setNarrationMode] = useState<NarrationMode>('lipsync');
  const [narratorVoice, setNarratorVoice] = useState<NarratorVoice>('wanita');
  const [cameraPattern, setCameraPattern] = useState<CameraPattern>('single_angle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Snapshot of the scene plan at generate time -- Regenerate/Hook Variants
  // must reuse the per-scene overrides that actually produced the result,
  // even if the user has since edited the scene list above.
  const [generatedScenePlan, setGeneratedScenePlan] = useState<SceneInput[]>([]);
  // Bumped on every successful generate and used as SceneOutputPanel's key, so
  // the panel remounts instead of carrying its internal state (hook variants in
  // particular) across into an unrelated result.
  const [generationId, setGenerationId] = useState(0);
  // Set from fetchHookSuggestion() when a product is picked -- shown as a
  // hint under HookArchetypeSelector so the "rotation" is a visible default
  // change the admin can override, never a silent server-side substitution.
  const [hookSuggestionHint, setHookSuggestionHint] = useState<string | null>(null);

  const generateContent = useGenerateContent();
  const { toast } = useToast();

  const handleSelectProduct = (p: Product) => {
    setProduct(p);
    setScenes([]);
    setResult(null);
    setHookSuggestionHint(null);
    fetchHookSuggestion(p.id)
      .then(({ suggested_archetype, recent }) => {
        setHookArchetype(suggested_archetype);
        if (recent.length > 0 && recent[0].hook_archetype_label) {
          setHookSuggestionHint(`Terakhir pakai: ${recent[0].hook_archetype_label} -- disarankan coba teknik lain.`);
        }
      })
      .catch(() => {
        // best-effort suggestion only -- keep the existing default hookArchetype on failure
      });
  };

  const MAX_SCENES = 10;

  const handleAddScene = (url: string) => {
    if (scenes.length >= MAX_SCENES) {
      toast({
        variant: "destructive",
        title: "Batas scene tercapai",
        description: `Maksimal ${MAX_SCENES} scene per generate -- lebih dari itu berisiko gagal karena output AI terpotong.`,
      });
      return;
    }
    setScenes((prev) => [...prev, { imageUrl: url, duration: 10, narrationMode: null, cameraPattern: null }]);
  };

  const usageCounts = scenes.reduce<Record<string, number>>((acc, s) => {
    acc[s.imageUrl] = (acc[s.imageUrl] ?? 0) + 1;
    return acc;
  }, {});

  // Suggest the platform's expected orientation when it changes -- user can
  // still override manually afterward via AspectRatioSelector.
  const handlePlatformChange = (next: PlatformTarget) => {
    setPlatform(next);
    setAspectRatio(getPlatformDefaultRatio(next));
  };

  const handleGenerate = () => {
    if (!product || scenes.length === 0) return;
    generateContent.mutate(
      {
        productId: product.id,
        scenes,
        characterId,
        style,
        aiTool,
        platform,
        aspectRatio,
        hookArchetype,
        contentGoal,
        ctaType,
        languageTone,
        includePrice,
        narrationMode,
        cameraPattern,
        narratorVoice,
      },
      {
        onSuccess: (data) => {
          setResult(data.result);
          setWarnings(data.warnings);
          setGeneratedScenePlan(scenes);
          setGenerationId((n) => n + 1);
          toast({ title: "Berhasil", description: "Konten berhasil digenerate." });
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Gagal generate", description: error.message });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="h-4 w-4 mr-2" />
            1. Pilih Produk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPicker selectedProduct={product} onSelect={handleSelectProduct} />
        </CardContent>
      </Card>

      {product && (
        <Card>
          <CardHeader>
            <CardTitle>2. Mode Narasi (default)</CardTitle>
          </CardHeader>
          <CardContent>
            <NarrationModeSelector value={narrationMode} onChange={setNarrationMode} />
            <p className="text-xs text-muted-foreground mt-3">
              Ini nilai default untuk semua scene. Tiap scene bisa override sendiri di Card 4 (mis. scene 1 voiceover, scene 2 lipsync).
            </p>

            <div className="mt-4 pt-4 border-t">
              <label className="text-sm font-medium block mb-2">Suara Narator</label>
              <select
                className="text-sm border rounded px-3 py-2 bg-background w-full sm:w-64"
                value={narratorVoice}
                onChange={(e) => setNarratorVoice(e.target.value as NarratorVoice)}
              >
                <option value="wanita">Wanita</option>
                <option value="pria">Pria</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Berlaku untuk seluruh video (satu narator per video). Paling berpengaruh di Google Flow/Veo 3 yang membuat suaranya sendiri &mdash; tanpa ini, tiap generate bisa dapat suara yang berbeda-beda.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {product && (
        <Card>
          <CardHeader>
            <CardTitle>3. Pola Kamera (default)</CardTitle>
          </CardHeader>
          <CardContent>
            <CameraPatternSelector value={cameraPattern} onChange={setCameraPattern} />
            <p className="text-xs text-muted-foreground mt-3">
              Teknik selang-seling shot (single angle vs A-roll/B-roll) -- beda dari "Gaya Video" di Card 9 yang mengatur nuansa keseluruhan. Ini juga nilai default, bisa di-override per scene di Card 4.
            </p>
          </CardContent>
        </Card>
      )}

      {product && (
        <Card>
          <CardHeader>
            <CardTitle>4. Scene: Foto Produk &amp; Durasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImagePicker product={product} usageCounts={usageCounts} onAddScene={handleAddScene} />
            <div className="pt-2 border-t">
              <ScenePlanner scenes={scenes} onChange={setScenes} aiTool={aiTool} />
            </div>
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>5. Karakter</CardTitle>
          </CardHeader>
          <CardContent>
            <CharacterPicker characterId={characterId} onSelect={setCharacterId} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>6. Platform &amp; Rasio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlatformSelector value={platform} onChange={handlePlatformChange} />
            <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>7. AI Video Tool Tujuan</CardTitle>
          </CardHeader>
          <CardContent>
            <AiToolSelector value={aiTool} onChange={setAiTool} hasCharacter={characterId !== null} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>8. Pola Hook Scene 1</CardTitle>
          </CardHeader>
          <CardContent>
            <HookArchetypeSelector value={hookArchetype} onChange={setHookArchetype} />
            {hookSuggestionHint && (
              <p className="text-xs text-muted-foreground mt-2">{hookSuggestionHint}</p>
            )}
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>9. Gaya Video</CardTitle>
          </CardHeader>
          <CardContent>
            <StyleSelector value={style} onChange={setStyle} />
            <p className="text-xs text-muted-foreground mt-3">
              Nuansa/tempo keseluruhan video (mis. santai vs persuasif) -- beda dari "Pola Kamera" di Card 3 yang mengatur teknik shot.
            </p>
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>10. Gaya Bahasa</CardTitle>
          </CardHeader>
          <CardContent>
            <LanguageToneSelector value={languageTone} onChange={setLanguageTone} />
            <p className="text-xs text-muted-foreground mt-3">
              Seberapa gaul/formal narasinya -- independen dari "Gaya Video" di atas (yang mengatur struktur cerita, bukan nada bicara). Mempengaruhi panjang kalimat & kecepatan bicara juga.
            </p>
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>11. Tujuan Konten</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentGoalSelector value={contentGoal} onChange={setContentGoal} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>12. Opsi Harga</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch id="include-price" checked={includePrice} onCheckedChange={setIncludePrice} />
              <Label htmlFor="include-price" className="text-sm cursor-pointer">
                Sertakan harga di narasi
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>13. CTA</CardTitle>
          </CardHeader>
          <CardContent>
            <CtaTypeSelector value={ctaType} onChange={setCtaType} contentGoal={contentGoal} platform={platform} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Button onClick={handleGenerate} disabled={generateContent.isPending} size="lg">
          {generateContent.isPending ? 'Generating...' : `Generate ${scenes.length} Scene`}
        </Button>
      )}

      {result && product && (
        <SceneOutputPanel
          // Remounts on a new generation so panel-local state (hook variants,
          // in-flight regenerate index) can't survive into a result it was
          // never derived from.
          key={generationId}
          result={result}
          onResultChange={setResult}
          warnings={warnings}
          onWarningsChange={setWarnings}
          scenePlan={generatedScenePlan}
          affiliateUrl={product.affiliate_url}
          productCategory={product.category}
          productSubcategory={product.subcategory}
          context={{
            productId: product.id,
            characterId,
            style,
            aiTool,
            platform,
            aspectRatio,
            hookArchetype,
            contentGoal,
            ctaType,
            languageTone,
            includePrice,
            narrationMode,
            cameraPattern,
            narratorVoice,
          }}
        />
      )}
    </div>
  );
}
