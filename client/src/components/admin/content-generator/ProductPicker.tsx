import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useProducts } from "@/hooks/useProductQueries";
import type { Product } from "@/types";

interface ProductPickerProps {
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
}

export function ProductPicker({ selectedProduct, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const { data: products, isLoading } = useProducts();

  const filtered = (products || []).filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat produk...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filtered.map((product) => (
            <Card
              key={product.id}
              className={`cursor-pointer transition-colors ${
                selectedProduct?.id === product.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => onSelect(product)}
            >
              <CardContent className="p-3 flex gap-3 items-center">
                {product.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.product_name} className="w-12 h-12 object-cover rounded" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{product.product_name}</p>
                  <p className="text-xs text-muted-foreground">Rp {Number(product.price).toLocaleString('id-ID')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Tidak ada produk ditemukan.</p>}
        </div>
      )}
    </div>
  );
}
