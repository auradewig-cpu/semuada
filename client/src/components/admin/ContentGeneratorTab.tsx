import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGenerateContent, type GenerationResult } from "@/hooks/useContentGenerator";
import { ProductPicker } from "@/components/admin/content-generator/ProductPicker";
import { ImagePicker } from "@/components/admin/content-generator/ImagePicker";
import { CharacterPicker } from "@/components/admin/content-generator/CharacterPicker";
import { StyleSelector, type ContentStyleId } from "@/components/admin/content-generator/StyleSelector";
import { SceneOutputPanel } from "@/components/admin/content-generator/SceneOutputPanel";
import type { Product } from "@/types";

export function ContentGeneratorTab() {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [style, setStyle] = useState<ContentStyleId>('vlog');
  const [result, setResult] = useState<GenerationResult | null>(null);

  const generateContent = useGenerateContent();
  const { toast } = useToast();

  const handleSelectProduct = (p: Product) => {
    setProduct(p);
    setSelectedImageUrls([]);
    setResult(null);
  };

  const handleGenerate = () => {
    if (!product || selectedImageUrls.length === 0) return;
    generateContent.mutate(
      { productId: product.id, selectedImageUrls, characterId, style },
      {
        onSuccess: (data) => {
          setResult(data.result);
          if (data.warnings.length > 0) {
            toast({ variant: "destructive", title: "Ada peringatan", description: data.warnings.join(' ') });
          } else {
            toast({ title: "Berhasil", description: "Konten berhasil digenerate." });
          }
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
            <ImagePicker product={product} selectedImageUrls={selectedImageUrls} onChange={setSelectedImageUrls} />
          </CardContent>
        </Card>
      )}

      {product && selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Karakter</CardTitle>
          </CardHeader>
          <CardContent>
            <CharacterPicker characterId={characterId} onSelect={setCharacterId} />
          </CardContent>
        </Card>
      )}

      {product && selectedImageUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Gaya Video</CardTitle>
          </CardHeader>
          <CardContent>
            <StyleSelector value={style} onChange={setStyle} />
          </CardContent>
        </Card>
      )}

      {product && selectedImageUrls.length > 0 && (
        <Button onClick={handleGenerate} disabled={generateContent.isPending} size="lg">
          {generateContent.isPending ? 'Generating...' : `Generate ${selectedImageUrls.length} Scene`}
        </Button>
      )}

      {result && <SceneOutputPanel result={result} />}
    </div>
  );
}
