import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
  /** Applied to the fixed-size root wrapper, e.g. "w-full h-48". */
  className?: string;
}

const FALLBACK_IMAGE = 'https://via.placeholder.com/300';
const IMAGE_CLASS = 'object-cover group-hover:scale-110 transition-transform duration-300';

function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.src = FALLBACK_IMAGE;
}

export function ProductImageCarousel({ images, alt, className }: ProductImageCarouselProps) {
  const slides = images.length > 0 ? images.slice(0, 5) : [FALLBACK_IMAGE];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

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
        />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((src, i) => (
            <div key={i} className="relative min-w-0 shrink-0 grow-0 basis-full h-full">
              <Image
                src={src}
                alt={`${alt} - foto ${i + 1}`}
                fill
                sizes="(max-width: 640px) 45vw, 220px"
                quality={70}
                className={IMAGE_CLASS}
                onError={handleImageError}
              />
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
