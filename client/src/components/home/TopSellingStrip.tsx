"use client";

import { TrendingUp } from "lucide-react";
import { useBestSellers, useTrackProductClick } from "@/hooks/useProductQueries";
import { formatPrice, formatSalesCount } from "@/lib/utils";

// Homepage "Terlaris Minggu Ini" -- a horizontal, scroll-snapping strip of the
// best-selling products (sort=terlaris, prefetched server-side).
export function TopSellingStrip() {
  const { data: products = [] } = useBestSellers(10);
  const { mutate: trackProductClick } = useTrackProductClick();

  if (products.length === 0) return null;

  const handleClick = (productId: string, url: string | null) => {
    trackProductClick(productId);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section aria-label="Terlaris Minggu Ini">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-bold">
          <TrendingUp className="h-5 w-5 text-emerald" aria-hidden="true" />
          Terlaris Minggu Ini
        </h2>
      </div>

      <div className="-mx-4 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-px-4 px-4">
        <div className="flex gap-3 w-max">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleClick(product.id, product.affiliate_url)}
              className="snap-start w-[130px] shrink-0 bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow text-left focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url || "https://via.placeholder.com/300"}
                  alt={product.product_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {product.sales && product.sales > 500 && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow text-yellow-foreground rounded text-[9px] font-semibold">
                    LARIS
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="text-[11px] leading-tight line-clamp-2 h-8">{product.product_name}</p>
                <p className="text-[13px] font-bold text-emerald mt-1">{formatPrice(product.price)}</p>
                {product.sales && (
                  <p className="text-[10px] text-muted-foreground">{formatSalesCount(product.sales)} terjual</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
