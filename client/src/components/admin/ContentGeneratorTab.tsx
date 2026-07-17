import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useGenerateContent,
  type GenerationResult,
  type ContentStyleId,
  type AiToolId,
  type PlatformTarget,
  type AspectRatio,
  type HookArchetype,
  type ContentGoal,
  type CtaTypeId,
  type NarrationMode,
  type CameraPattern,
  type SceneInput,
} from "@/hooks/useContentGenerator";
import { ProductPicker } from "@/components/admin/content-generator/ProductPicker";
import { ImagePicker } from "@/components/admin/content-generator/ImagePicker";
import { ScenePlanner } from "@/components/admin/content-generator/ScenePlanner";
import { CharacterPicker } from "@/components/admin/content-generator/CharacterPicker";
import { PlatformSelector } from "@/components/admin/content-generator/PlatformSelector";
import { AspectRatioSelector } from "@/components/admin/content-generator/AspectRatioSelector";
import { AiToolSelector } from "@/components/admin/content-generator/AiToolSelector";
import { StyleSelector } from "@/components/admin/content-generator/StyleSelector";
import { ContentGoalSelector } from "@/components/admin/content-generator/ContentGoalSelector";
import { CtaTypeSelector } from "@/components/admin/content-generator/CtaTypeSelector";
import { HookArchetypeSelector } from "@/components/admin/content-generator/HookArchetypeSelector";
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
  const [includePrice, setIncludePrice] = useState(true);
  const [narrationMode, setNarrationMode] = useState<NarrationMode>('lipsync');
  const [cameraPattern, setCameraPattern] = useState<CameraPattern>('single_angle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const generateContent = useGenerateContent();
  const { toast } = useToast();

  const handleSelectProduct = (p: Product) => {
    setProduct(p);
    setScenes([]);
    setResult(null);
  };

  const handleAddScene = (url: string) => {
    setScenes((prev) => [...prev, { imageUrl: url, duration: 8, narrationMode: null, cameraPattern: null }]);
  };

  const usageCounts = scenes.reduce<Record<string, number>>((acc, s) => {
    acc[s.imageUrl] = (acc[s.imageUrl] ?? 0) + 1;
    return acc;
  }, {});

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
        includePrice,
        narrationMode,
        cameraPattern,
      },
      {
        onSuccess: (data) => {
          setResult(data.result);
          setWarnings(data.warnings);
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
              <ScenePlanner scenes={scenes} onChange={setScenes} />
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
            <PlatformSelector value={platform} onChange={setPlatform} />
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
            <AiToolSelector value={aiTool} onChange={setAiTool} />
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
            <CardTitle>10. Tujuan Konten</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentGoalSelector value={contentGoal} onChange={setContentGoal} />
          </CardContent>
        </Card>
      )}

      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>11. Opsi Harga</CardTitle>
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
            <CardTitle>12. CTA</CardTitle>
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
          result={result}
          onResultChange={setResult}
          warnings={warnings}
          affiliateUrl={product.affiliate_url}
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
            includePrice,
            narrationMode,
            cameraPattern,
          }}
        />
      )}
    </div>
  );
}
