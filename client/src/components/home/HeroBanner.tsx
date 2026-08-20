"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, TrendingUp, Award, ArrowRight } from "lucide-react";
import { useFeaturedProducts } from "@/hooks/useProductQueries";
import { formatPrice, calculateDiscount, formatSalesCount } from "@/lib/utils";
import type { Product } from "@/types";

interface HeroBannerProps {
  onProductClick: (productId: string) => void;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=600&fit=crop&crop=center";
// The featured set can be up to ~27 slides; a dot per slide crowds a 390px
// viewport, so cap it and slide the window as the user moves through.
const MAX_DOTS = 6;

// Short, aspect-ratio-driven hero for the homepage only (the category pages
// deliberately don't render it -- 11 of 18 categories have no featured rows).
// Returns null when there is nothing to show, so a category without featured
// products never renders a 384px empty box. unoptimized: same reason as
// ProductImageCarousel.tsx -- hotlinked Shopee URLs would exhaust Vercel's
// Image Optimization quota (real incident, 2026-08-10).
export function HeroBanner({ onProductClick }: HeroBannerProps) {
  const { data: products = [] } = useFeaturedProducts();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: products.length > 1, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // prefers-reduced-motion: respect it by not auto-advancing the carousel.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (reduceMotion || !emblaApi || products.length <= 1) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(interval);
  }, [emblaApi, reduceMotion, products.length]);

  if (products.length === 0) return null;

  const halfWindow = Math.floor(MAX_DOTS / 2);
  const windowStart = Math.min(
    Math.max(selectedIndex - halfWindow, 0),
    Math.max(products.length - MAX_DOTS, 0)
  );
  const dotIndices = products
    .map((_, i) => i)
    .slice(windowStart, windowStart + Math.min(MAX_DOTS, products.length));

  const handleClick = (product: Product) => {
    onProductClick(product.id);
    if (product.affiliate_url) window.open(product.affiliate_url, "_blank", "noopener,noreferrer");
  };

  // Fixed responsive heights, NOT aspect-ratio + max-height. With
  // `aspect-[21/9] max-h-[420px]` the browser preserves the ratio by shrinking
  // the WIDTH once max-height clamps the height, so on a 1900px desktop the
  // hero rendered 980px wide (420 x 21/9) and left-aligned instead of
  // full-bleed. Same trap applied to tablets via `aspect-[2/1] max-h-[240px]`.
  return (
    <section
      aria-label="Produk unggulan"
      className="relative w-full overflow-hidden bg-gradient-to-br from-emerald/10 to-metallic/10 h-[195px] sm:h-[240px] md:h-[320px] lg:h-[420px]"
    >
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {products.map((product, index) => {
            const rating = parseFloat(product.rating?.toString() || "0");
            const isNearby = Math.abs(index - selectedIndex) <= 1;
            return (
              <div key={product.id} className="relative min-w-0 shrink-0 grow-0 basis-full h-full">
                {isNearby && (
                  <Image
                    src={product.image_url || FALLBACK_IMAGE}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="100vw"
                    quality={70}
                    className="object-cover"
                    priority={index === 0}
                    unoptimized
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60" />

                <div className="relative z-10 container mx-auto px-4 h-full flex items-center">
                  <div className="text-white max-w-xl">
                    <div className="flex items-center gap-2 mb-1 md:mb-2">
                      {product.sales && product.sales > 500 && (
                        <span className="px-2 py-0.5 bg-yellow text-yellow-foreground rounded-full text-xs font-semibold flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> TERLARIS
                        </span>
                      )}
                      {rating > 4.5 && (
                        <span className="px-2 py-0.5 bg-violet text-violet-foreground rounded-full text-xs font-semibold flex items-center gap-1">
                          <Award className="h-3 w-3" /> REKOMENDASI
                        </span>
                      )}
                    </div>

                    <h2
                      className="text-base md:text-3xl lg:text-4xl font-bold leading-snug line-clamp-2"
                      title={product.product_name}
                    >
                      {product.product_name}
                    </h2>

                    <div className="flex items-baseline gap-2 mt-1 md:mt-2">
                      <span className="text-lg md:text-2xl font-bold text-yellow">
                        {formatPrice(product.price)}
                      </span>
                      {product.original_price && (
                        <span className="text-xs md:text-sm text-gray-300 line-through">
                          {formatPrice(product.original_price)}
                        </span>
                      )}
                      {product.original_price &&
                        calculateDiscount(Number(product.price), Number(product.original_price)) > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald text-emerald-foreground rounded text-[10px] md:text-xs font-semibold">
                            HEMAT {calculateDiscount(Number(product.price), Number(product.original_price))}%
                          </span>
                        )}
                    </div>

                    {(rating > 0 || product.sales) && (
                      <p className="text-xs md:text-sm text-white/80 mt-1">
                        {rating > 0 && `Bintang ${rating.toFixed(1)}`}
                        {rating > 0 && product.sales ? " · " : ""}
                        {product.sales ? `${formatSalesCount(product.sales)} terjual` : ""}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleClick(product)}
                      className="mt-2 md:mt-4 inline-flex items-center gap-1 px-3 py-1.5 md:px-5 md:py-2 bg-gradient-to-r from-emerald to-metallic text-white rounded-lg text-xs md:text-sm font-semibold hover:brightness-110 transition-all"
                    >
                      <span>Lihat Produk</span>
                      <ArrowRight className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arrows */}
      {products.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            aria-label="Slide sebelumnya"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 md:h-10 md:w-10 bg-black/20 text-white hover:bg-black/40 rounded-full flex items-center justify-center z-20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            aria-label="Slide berikutnya"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 md:h-10 md:w-10 bg-black/20 text-white hover:bg-black/40 rounded-full flex items-center justify-center z-20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Indicators -- sliding window capped at MAX_DOTS */}
      {products.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
          {dotIndices.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Ke slide ${index + 1}`}
              aria-current={selectedIndex === index}
              className="h-4 w-4 flex items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  selectedIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
