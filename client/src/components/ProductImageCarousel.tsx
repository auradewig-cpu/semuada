import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
  /** Applied to the fixed-size root wrapper, e.g. "w-full h-48". */
  className?: string;
  /**
   * Marks this image eager + high fetch priority instead of the Next.js
   * Image default (lazy + low priority) -- for cards likely above the fold
   * (the first grid row) so they don't compete with the LCP candidate for
   * bandwidth/lazy-load timing. Leave unset for everything else; marking too
   * many images priority defeats its own purpose.
   */
  priority?: boolean;
}

const FALLBACK_IMAGE = 'https://via.placeholder.com/300';
const IMAGE_CLASS = 'object-cover group-hover:scale-110 transition-transform duration-300';

// unoptimized: every product image is a hotlinked, ever-growing set of
// distinct scraped Shopee URLs (thousands and counting) -- Vercel's Image
// Optimization bills/limits by unique SOURCE image, so a big scraping run
// can blow through the plan's quota and every /_next/image request starts
// returning 402 site-wide (real incident, 2026-08-10). Serving these
// as-is sidesteps that quota entirely; the source is already compressed
// webp, so the loss is just responsive srcset/format conversion, not raw
// image quality.

function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.src = FALLBACK_IMAGE;
}

export function ProductImageCarousel({ images, alt, className, priority }: ProductImageCarouselProps) {
  const slides = images.length > 0 ? images.slice(0, 5) : [FALLBACK_IMAGE];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  // Off-screen slides are only clipped by `overflow-hidden`; their boxes still
  // sit inside the viewport, so loading="lazy" never skipped them and a 20-card
  // grid downloaded ~4 full-size images PER CARD up front (measured: 84-119
  // <img> per page). Only the visible slide is rendered until the user shows
  // intent on this particular carousel -- then its neighbours come along too.
  const [primed, setPrimed] = useState(false);
  const prime = useCallback(() => setPrimed(true), []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    // Guarded on index: this also runs once on init (at 0), where priming would
    // defeat the whole point.
    if (index !== 0) setPrimed(true);
    setSelectedIndex(index);
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    // Embla's own pointerDown is the most reliable "user is about to drag"
    // signal across mouse and touch -- it fires before the drag threshold, so
    // the neighbouring image starts downloading as the swipe begins.
    emblaApi.on('pointerDown', prime);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
      emblaApi.off('pointerDown', prime);
    };
  }, [emblaApi, onSelect, prime]);

  // Single image: plain <img>, no carousel overhead/controls.
  if (slides.length <= 1) {
    return (
      <div className={`relative overflow-hidden ${className ?? ''}`}>
        <Image
          src={slides[0]}
          alt={alt}
          fill
          sizes="(max-width: 640px) 45vw, 220px"
          quality={70}
          className={IMAGE_CLASS}
          onError={handleImageError}
          priority={priority}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      onMouseEnter={prime}
      onPointerDown={prime}
      onTouchStart={prime}
      onFocus={prime}
    >
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((src, i) => (
            <div key={i} className="relative min-w-0 shrink-0 grow-0 basis-full h-full bg-muted">
              {(i === selectedIndex || (primed && Math.abs(i - selectedIndex) <= 1)) && (
                <Image
                  src={src}
                  alt={`${alt} - foto ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 45vw, 220px"
                  quality={70}
                  className={IMAGE_CLASS}
                  onError={handleImageError}
                  priority={priority && i === 0}
                  unoptimized
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {canScrollPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollPrev();
          }}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Foto sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollNext();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Foto berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === selectedIndex ? 'w-3 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
