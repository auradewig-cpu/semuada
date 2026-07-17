import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts, useItemOptionsByCategory } from "@/hooks/useProductQueries";
import { useCategoryContext } from "@/context/CategoryContext";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductPickerProps {
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
}

function getCommission(product: Product): number {
  return Number(product.commission ?? product.komisi ?? 0);
}

export function ProductPicker({ selectedProduct, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined);
  const [item, setItem] = useState<string | undefined>(undefined);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [commissionMin, setCommissionMin] = useState('');
  const [commissionMax, setCommissionMax] = useState('');

  const { data: products, isLoading } = useProducts();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const { data: itemOptions } = useItemOptionsByCategory(category, subcategory);

  const subcategories = category ? Array.from(hierarchy.get(category) || []).sort() : [];

  const resetFilters = () => {
    setCategory(undefined);
    setSubcategory(undefined);
    setItem(undefined);
    setPriceMin('');
    setPriceMax('');
    setCommissionMin('');
    setCommissionMax('');
  };

  const filtered = useMemo(() => {
    let result = products || [];

    if (search) {
      result = result.filter((p) => p.product_name.toLowerCase().includes(search.toLowerCase()));
    }
    if (category) {
      result = result.filter((p) => p.category === category);
    }
    if (subcategory) {
      result = result.filter((p) => p.subcategory === subcategory);
    }
    if (item) {
      result = result.filter((p) => p.item === item);
    }
    if (priceMin) {
      result = result.filter((p) => Number(p.price) >= Number(priceMin));
    }
    if (priceMax) {
      result = result.filter((p) => Number(p.price) <= Number(priceMax));
    }
    if (commissionMin) {
      result = result.filter((p) => getCommission(p) >= Number(commissionMin));
    }
    if (commissionMax) {
      result = result.filter((p) => getCommission(p) <= Number(commissionMax));
    }

    return result;
  }, [products, search, category, subcategory, item, priceMin, priceMax, commissionMin, commissionMax]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4 mr-1" /> Filter
        </Button>
      </div>

      {showFilters && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select
              value={category ?? 'all'}
              onValueChange={(v) => {
                setCategory(v === 'all' ? undefined : v);
                setSubcategory(undefined);
                setItem(undefined);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {!isCategoryLoading &&
                  Array.from(hierarchy.keys()).sort().map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={subcategory ?? 'all'}
              onValueChange={(v) => {
                setSubcategory(v === 'all' ? undefined : v);
                setItem(undefined);
              }}
              disabled={!category}
            >
              <SelectTrigger>
                <SelectValue placeholder="Subkategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Subkategori</SelectItem>
                {subcategories.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={item ?? 'all'}
              onValueChange={(v) => setItem(v === 'all' ? undefined : v)}
              disabled={!itemOptions || itemOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Item</SelectItem>
                {itemOptions?.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input type="number" placeholder="Harga min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            <Input type="number" placeholder="Harga max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            <Input type="number" placeholder="Komisi min" value={commissionMin} onChange={(e) => setCommissionMin(e.target.value)} />
            <Input type="number" placeholder="Komisi max" value={commissionMax} onChange={(e) => setCommissionMax(e.target.value)} />
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Filter
          </Button>
        </div>
      )}

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
                  <img src={product.image_url} alt={product.product_name} className="w-14 h-14 object-cover rounded shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{product.product_name}</p>
                  {product.product_id && (
                    <p className="text-xs text-muted-foreground truncate">ID: {product.product_id}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Rp {Number(product.price).toLocaleString('id-ID')}</p>
                  <p className="text-xs text-emerald">Komisi: {formatPrice(getCommission(product))}</p>
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
