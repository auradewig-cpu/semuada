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
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [sceneDurations, setSceneDurations] = useState<number[]>([]);
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
    setSelectedImageUrls([]);
    setSceneDurations([]);
    setResult(null);
  };

  const handleImagesChange = (urls: string[]) => {
    setSelectedImageUrls(urls);
    setSceneDurations(urls.map((_, i) => sceneDurations[i] ?? 8));
  };

  const handleGenerate = () => {
    if (!product || selectedImageUrls.length === 0) return;
    generateContent.mutate(
      {
        productId: product.id,
        selectedImageUrls,
        characterId,
        style,
        aiTool,
        platform,
        aspectRatio,
        hookArchetype,
        contentGoal,
        ctaType,
        sceneDurations,
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
            <CardTitle>2. Pilih Foto Produk (urutan = nomor scene)</CardTitle>
          </CardHeader>
          <CardContent>
            <ImagePicker product={product} selectedImageUrls={selectedImageUrls} onChange={handleImagesChange} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Durasi per Scene</CardTitle>
          </CardHeader>
          <CardContent>
            <ScenePlanner sceneDurations={sceneDurations} onChange={setSceneDurations} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Karakter</CardTitle>
          </CardHeader>
          <CardContent>
            <CharacterPicker characterId={characterId} onSelect={setCharacterId} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>5. Platform &amp; Rasio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlatformSelector value={platform} onChange={setPlatform} />
            <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>6. AI Video Tool Tujuan</CardTitle>
          </CardHeader>
          <CardContent>
            <AiToolSelector value={aiTool} onChange={setAiTool} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>7. Gaya Video &amp; Tujuan Konten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StyleSelector value={style} onChange={setStyle} />
            <ContentGoalSelector value={contentGoal} onChange={setContentGoal} />
            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch id="include-price" checked={includePrice} onCheckedChange={setIncludePrice} />
              <Label htmlFor="include-price" className="text-sm cursor-pointer">
                Sertakan harga di narasi
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>8. Mode Narasi &amp; Pola Kamera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NarrationModeSelector value={narrationMode} onChange={setNarrationMode} />
            <CameraPatternSelector value={cameraPattern} onChange={setCameraPattern} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>9. CTA &amp; Pola Hook Scene 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CtaTypeSelector value={ctaType} onChange={setCtaType} contentGoal={contentGoal} platform={platform} />
            <HookArchetypeSelector value={hookArchetype} onChange={setHookArchetype} />
          </CardContent>
        </Card>
      )}

      {selectedImageUrls.length > 0 && (
        <Button onClick={handleGenerate} disabled={generateContent.isPending} size="lg">
          {generateContent.isPending ? 'Generating...' : `Generate ${selectedImageUrls.length} Scene`}
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
