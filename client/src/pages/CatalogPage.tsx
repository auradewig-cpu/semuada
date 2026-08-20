"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SubcategoryChips } from "@/components/catalog/SubcategoryChips";
import { SortBar } from "@/components/catalog/SortBar";
import { ActiveFilterChips } from "@/components/catalog/ActiveFilterChips";
import { FilterSheet } from "@/components/catalog/FilterSheet";
import { FilterPanel } from "@/components/catalog/FilterPanel";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useCatalogFilters } from "@/hooks/useCatalogFilters";
import { useLocationOptions, useTrackProductClick } from "@/hooks/useProductQueries";
import { buildInitialFilters } from "@root/lib/productFilters";
import type { ProductFilters } from "@root/lib/productFilters";
import type { CategoryEntry } from "@root/lib/categories";

interface CatalogPageProps {
  categoryName: string;
  subcategoryName?: string;
  categorySlug: string;
  subcategorySlug?: string;
  /** Server-provided catalog (counts included) for the chips row. */
  categories: CategoryEntry[];
}

// The category/subcategory page -- header, subcategory chips, a sticky Shopee-
// style SortBar + mobile filter bottom sheet, active-filter chips, and the
// infinite product grid. No banner (categories without featured rows must never
// show an empty box). Filtering lives in the URL via useCatalogFilters.
export function CatalogPage({
  categoryName,
  subcategoryName,
  categorySlug,
  subcategorySlug,
  categories,
}: CatalogPageProps) {
  const base = buildInitialFilters({ category: categoryName, subcategory: subcategoryName });
  const { filters, setFilters, patch, reset, activeCount } = useCatalogFilters(base);
  const { mutate: trackProductClick } = useTrackProductClick();
  const { data: locationOptions = [], isLoading: isLoadingLocation } = useLocationOptions(
    categoryName,
    subcategoryName
  );

  const categoryEntry = categories.find((c) => c.name === categoryName);
  const subcategories = categoryEntry?.subcategories ?? [];

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
        category={categoryName}
        subcategory={subcategoryName}
        activeCount={activeCount}
        locationOptions={locationOptions}
        isLoadingLocation={isLoadingLocation}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader variant="catalog" activeCategory={categoryName} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-4 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1 flex-wrap">
          <li>
            <Link href="/" className="hover:text-emerald">Beranda</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="h-3 w-3" /></li>
          <li>
            <Link href={`/${categorySlug}`} className="hover:text-emerald">{categoryName}</Link>
          </li>
          {subcategoryName && (
            <>
              <li aria-hidden="true"><ChevronRight className="h-3 w-3" /></li>
              <li aria-current="page" className="text-foreground font-medium">{subcategoryName}</li>
            </>
          )}
        </ol>
      </nav>

      <SubcategoryChips subcategories={subcategories} categorySlug={categorySlug} />
      <SortBar sortBy={filters.sortBy} onSortChange={handleSortChange} filterTrigger={filterTrigger} />
      <ActiveFilterChips filters={filters} onRemove={handleRemoveFilter} onClearAll={reset} />

      <main className="container mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Desktop filter sidebar (apply-langsung). */}
          <aside className="hidden lg:block lg:col-span-1">
            {/* Sticks below the header AND the sticky SortBar (~3.5rem tall),
                both measured from --header-h rather than hardcoded. */}
            <div className="bg-card rounded-xl border border-border p-5 sticky top-[calc(var(--header-h)_+_3.5rem)] max-h-[calc(100vh_-_var(--header-h)_-_5rem)] overflow-y-auto">
              <h3 className="font-bold text-lg mb-5">Filter Produk</h3>
              <FilterPanel
                filters={filters}
                onChange={patch}
                category={categoryName}
                subcategory={subcategoryName}
                locationOptions={locationOptions}
                isLoadingLocation={isLoadingLocation}
              />
            </div>
          </aside>

          {/* Product grid */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl md:text-2xl font-bold">
                {subcategoryName ?? categoryName}
              </h1>
              <span className="text-sm text-muted-foreground">
                {activeCount > 0 ? `${activeCount} filter aktif` : "Semua produk"}
              </span>
            </div>
            {/* No "does this category have products" gate here: the category
                list is ISR-cached, so a category added after the last snapshot
                would be reported empty while its grid works fine. ProductGrid
                renders its own empty state from the actual result. */}
            <ProductGrid
              filters={filters}
              onProductClick={handleProductClick}
              onResetFilters={reset}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
