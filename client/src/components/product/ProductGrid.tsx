"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useInfiniteProducts } from "@/hooks/useProductQueries";
import type { ProductFilters } from "@root/lib/productFilters";

interface ProductGridProps {
  filters: ProductFilters;
  onProductClick: (productId: string) => void;
  /** Called by the empty state's "Hapus filter" button (e.g. clear search). */
  onResetFilters: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

// Skeleton and real grid must use the SAME column classes, otherwise the layout
// jumps at whichever breakpoint they disagree on.
const GRID_CLASS = "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4";

// Auto-loads up to this many pages via the scroll sentinel before falling back
// to a manual "Muat Lebih Banyak" button (keeps very long catalogs controllable
// and avoids runaway fetches on fast scrolls).
const AUTO_LOAD_PAGES = 3;

export function ProductGrid({
  filters,
  onProductClick,
  onResetFilters,
  emptyTitle = "Produk tidak ditemukan",
  emptyDescription = "Coba gunakan kata kunci lain atau ubah filter pencarian",
}: ProductGridProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isProductsLoading,
  } = useInfiniteProducts(filters);

  const allProducts = data?.pages.flatMap((page) => page) ?? [];

  const [autoLoaded, setAutoLoaded] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleFetchMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
    setAutoLoaded((n) => n + 1);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && autoLoaded < AUTO_LOAD_PAGES) handleFetchMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [handleFetchMore, autoLoaded]);

  // Reset the auto-load counter when the filter (query key) changes so a new
  // search gets its full budget back.
  useEffect(() => {
    setAutoLoaded(0);
  }, [filters]);

  return (
    <section>
      {/* Only the result count is announced. aria-live on the whole section made
          screen readers re-read every card on any change. */}
      <p className="sr-only" aria-live="polite">
        {isProductsLoading ? "Memuat produk" : `${allProducts.length} produk ditampilkan`}
      </p>

      {isProductsLoading && (
        <div className={GRID_CLASS}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
              <div className="bg-muted aspect-square rounded-lg mb-4"></div>
              <div className="bg-muted h-4 rounded mb-2"></div>
              <div className="bg-muted h-4 rounded w-2/3 mb-4"></div>
              <div className="bg-muted h-8 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {!isProductsLoading && allProducts.length > 0 && (
        <div className={GRID_CLASS}>
          {allProducts.map((product, index) => (
            <ProductCard
              key={`${product.id}-${index}`}
              product={product}
              onProductClick={onProductClick}
              priority={index < 4}
              variant="compact"
            />
          ))}
        </div>
      )}

      {!isProductsLoading && allProducts.length === 0 && (
        <div className="text-center py-16">
          <Search className="h-16 w-16 text-muted-foreground mb-4 mx-auto" />
          <h3 className="text-xl font-semibold mb-2">{emptyTitle}</h3>
          <p className="text-muted-foreground mb-4">{emptyDescription}</p>
          <Button
            onClick={onResetFilters}
            className="bg-emerald text-emerald-foreground hover:bg-emerald/90"
          >
            Hapus Filter
          </Button>
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {hasNextPage && autoLoaded >= AUTO_LOAD_PAGES && !isFetchingNextPage && (
        <div className="mt-12 text-center">
          <Button
            onClick={handleFetchMore}
            disabled={isFetchingNextPage}
            className="bg-emerald text-emerald-foreground hover:bg-emerald/90"
          >
            Muat Lebih Banyak
          </Button>
        </div>
      )}

      {isFetchingNextPage && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald" />
        </div>
      )}
    </section>
  );
}
