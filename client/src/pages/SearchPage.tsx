"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SortBar } from "@/components/catalog/SortBar";
import { ActiveFilterChips } from "@/components/catalog/ActiveFilterChips";
import { FilterSheet } from "@/components/catalog/FilterSheet";
import { FilterPanel } from "@/components/catalog/FilterPanel";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useCatalogFilters } from "@/hooks/useCatalogFilters";
import { useLocationOptions, useTrackProductClick } from "@/hooks/useProductQueries";
import { buildInitialFilters } from "@root/lib/productFilters";
import type { ProductFilters } from "@root/lib/productFilters";

// Search results page -- same Shopee-style catalog layout, sourced from the
// ?q= query. Fetched client-side (this page is deliberately not prefetched, so
// useSearchParams is safe here, wrapped in Suspense below).
function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const base: ProductFilters = { ...buildInitialFilters(), search: q };
  const { filters, setFilters, patch, reset, activeCount } = useCatalogFilters(base);
  const { mutate: trackProductClick } = useTrackProductClick();
  const { data: locationOptions = [], isLoading: isLoadingLocation } = useLocationOptions();

  const handleProductClick = useCallback((productId: string) => {
    trackProductClick(productId);
  }, [trackProductClick]);

  const handleSortChange = useCallback(
    (sortBy: ProductFilters["sortBy"]) => patch({ sortBy }),
    [patch]
  );

  const handleRemoveFilter = useCallback(
    (part: Partial<ProductFilters>) => patch(part),
    [patch]
  );

  const filterTrigger = (
    <div className="lg:hidden">
      <FilterSheet
        filters={filters}
        base={base}
        onApply={setFilters}
        activeCount={activeCount}
        locationOptions={locationOptions}
        isLoadingLocation={isLoadingLocation}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader variant="catalog" initialSearch={q} />

      <div className="container mx-auto px-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Hasil pencarian untuk{" "}
          <span className="text-foreground font-medium">&ldquo;{q}&rdquo;</span>
        </p>
      </div>

      <SortBar sortBy={filters.sortBy} onSortChange={handleSortChange} filterTrigger={filterTrigger} />
      <ActiveFilterChips filters={filters} onRemove={handleRemoveFilter} onClearAll={reset} />

      <main className="container mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          <aside className="hidden lg:block lg:col-span-1">
            <div className="bg-card rounded-xl border border-border p-5 sticky top-[calc(var(--header-h)_+_3.5rem)] max-h-[calc(100vh_-_var(--header-h)_-_5rem)] overflow-y-auto">
              <h3 className="font-bold text-lg mb-5">Filter Produk</h3>
              <FilterPanel
                filters={filters}
                onChange={patch}
                locationOptions={locationOptions}
                isLoadingLocation={isLoadingLocation}
              />
            </div>
          </aside>

          <div className="lg:col-span-3">
            <ProductGrid
              filters={filters}
              onProductClick={handleProductClick}
              onResetFilters={reset}
              emptyTitle="Produk tidak ditemukan"
              emptyDescription={`Tidak ada hasil untuk "${q}". Coba kata kunci lain.`}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SearchResults />
    </Suspense>
  );
}
