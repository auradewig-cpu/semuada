"use client";

import { useCallback } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { HeroBanner } from "@/components/home/HeroBanner";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { TopSellingStrip } from "@/components/home/TopSellingStrip";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useTrackProductClick } from "@/hooks/useProductQueries";
import { buildInitialFilters } from "@root/lib/productFilters";
import type { CategoryEntry } from "@root/lib/categories";

interface HomePageProps {
  categories: CategoryEntry[];
}

// Stable query key for the homepage grid (no search filtering here -- search
// navigates to /cari?q=). Hoisted so the react-query key object is stable.
//
// Deliberately the default sort (newest) even though the section is headed
// "Rekomendasi Untukmu": the `rekomendasi` sort orders by md5(id || seed) with a
// per-browser-session seed, which the server cannot know at prerender time, so
// using it here would throw away app/page.tsx's server-side first-page prefetch
// (the thing that keeps this grid out of a hydration skeleton). Don't "fix" the
// mismatch by switching the sort without also solving the prefetch.
const HOME_FILTERS = buildInitialFilters();

// The homepage -- a marketplace layout: short hero, icon category grid (from
// server HTML, no client requests), a bestsellers strip, then an infinite
// "Rekomendasi Untukmu" grid. No filter panel (filtering only makes sense once
// a category is chosen).
export default function HomePage({ categories }: HomePageProps) {
  const { mutate: trackProductClick } = useTrackProductClick();

  const handleProductClick = useCallback((productId: string) => {
    trackProductClick(productId);
  }, [trackProductClick]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader variant="home" />
      <HeroBanner onProductClick={handleProductClick} />
      <main className="container mx-auto px-4 py-6 space-y-8">
        <CategoryGrid entries={categories} />
        <TopSellingStrip />
        <section aria-labelledby="rekomendasi-title">
          <h2 id="rekomendasi-title" className="text-xl md:text-2xl font-bold mb-4">
            Rekomendasi Untukmu
          </h2>
          <ProductGrid
            filters={HOME_FILTERS}
            onProductClick={handleProductClick}
            onResetFilters={() => {}}
          />
        </section>
      </main>
    </div>
  );
}
