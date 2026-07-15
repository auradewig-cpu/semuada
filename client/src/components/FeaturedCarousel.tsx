import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeaturedProducts } from '@/hooks/useProductQueries';
import { formatPrice, calculateDiscount, formatSalesCount } from '@/lib/utils';
import type { Product } from '@/types';

interface FeaturedCarouselProps {
  onProductClick: (productId: string) => void;
  activeCategory?: string;
}

export function FeaturedCarousel({ onProductClick, activeCategory }: FeaturedCarouselProps) {
  const { data: products = [], isLoading } = useFeaturedProducts(activeCategory);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (products.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % products.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [products.length]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [activeCategory]);

  const handleProductClick = (product: Product) => {
    onProductClick(product.id);
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank');
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % products.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + products.length) % products.length);
  };

  if (isLoading) {
    return (
      <section className="relative h-96 md:h-[500px] overflow-hidden bg-gradient-to-br from-emerald/10 to-metallic/10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="loading-pulse text-center">
            <div className="w-16 h-16 bg-muted rounded-full mb-4 mx-auto"></div>
            <p className="text-muted-foreground">Loading featured products...</p>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="relative h-96 md:h-[500px] overflow-hidden bg-gradient-to-br from-emerald/10 to-metallic/10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full mb-4 mx-auto flex items-center justify-center">
              <i className="fas fa-star text-muted-foreground text-2xl"></i>
            </div>
            <p className="text-muted-foreground">No featured products available</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-96 md:h-[500px] overflow-hidden bg-gradient-to-br from-emerald/10 to-metallic/10">
      <div className="absolute inset-0">
        {products.map((product, index) => {
          const discount = product.original_price
            ? calculateDiscount(Number(product.price), Number(product.original_price))
            : 0;
          const rating = parseFloat(product.rating?.toString() || '0');

          // Construct optimized image URLs
          const optimizedBgUrl = product.image_url
            ? `${product.image_url}?width=1200&quality=80`
            : 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=600&fit=crop&crop=center';

          const optimizedImageUrl = product.image_url
            ? `${product.image_url}?width=600&quality=85`
            : 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=600&fit=crop&crop=center';

          return (
            <div
              key={product.id}
              className={`absolute inset-0 w-full h-full transition-all duration-500 ${
                currentSlide === index
                  ? 'opacity-100 transform translate-x-0'
                  : index < currentSlide
                    ? 'opacity-0 transform -translate-x-full'
                    : 'opacity-0 transform translate-x-full'
              }`}
              data-testid={`carousel-slide-${index}`}
            >
              {/* Background image with overlay */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('${optimizedBgUrl}')`
                }}
              />

              <div className="relative z-10 container mx-auto px-4 h-full flex items-center pb-20 md:pb-0">
                <div className="grid md:grid-cols-2 gap-8 items-center w-full">
                  <div className="text-white">
                    <div className="flex items-center space-x-2 mb-4">
                      {product.sales && product.sales > 500 && (
                        <span className="px-3 py-1 bg-yellow text-yellow-foreground rounded-full text-sm font-semibold flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          TERLARIS
                        </span>
                      )}
                      {rating > 4.5 && (
                        <span className="px-3 py-1 bg-violet text-violet-foreground rounded-full text-sm font-semibold flex items-center gap-1">
                          <Award className="h-4 w-4" />
                          REKOMENDASI
                        </span>
                      )}
                    </div>

                    <h2 className="text-3xl md:text-5xl font-bold mb-2 line-clamp-2" title={product.product_name} data-testid={`carousel-product-name-${product.id}`}>
                      {product.product_name}
                    </h2>
                    <p className="text-lg text-white/80 mb-2 md:mb-4 leading-tight" data-testid={`carousel-product-id-${product.id}`}>
                      {product.product_id}
                    </p>

                    <div className="flex flex-col items-start mb-4 md:mb-6">
                      {product.original_price && (
                        <span className="text-lg text-gray-300 line-through leading-tight" data-testid={`carousel-original-price-${product.id}`}>
                          {formatPrice(product.original_price)}
                        </span>
                      )}
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl md:text-3xl font-bold text-yellow leading-tight" data-testid={`carousel-price-${product.id}`}>
                          {formatPrice(product.price)}
                        </span>
                        {product.original_price && (
                          <span className="px-2 py-1 bg-emerald text-emerald-foreground rounded text-sm font-semibold">
                            HEMAT {discount}%
                          </span>
                        )}
                      </div>
                    </div>

                    {(rating > 0 || product.sales) && (
                      <div className="flex items-center space-x-2 md:space-x-4 mb-4 md:mb-8 leading-tight">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i
                              key={star}
                              className={`fas fa-star text-sm ${
                                star <= rating ? 'text-yellow' : 'text-gray-400'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-white/80">
                            {rating.toFixed(1)} {product.sales && `(${formatSalesCount(product.sales)} terjual)`}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={() => handleProductClick(product)}
                      className="px-8 py-4 bg-gradient-to-r from-emerald to-metallic text-white rounded-xl font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center space-x-2"
                      data-testid={`button-carousel-product-${product.id}`}
                    >
                      <span>Lihat Produk</span>
                      <i className="fas fa-arrow-right"></i>
                    </Button>
                  </div>
                  
                  <div className="hidden md:block">
                    <img
                      src={optimizedImageUrl}
                      alt={product.product_name}
                      className="w-full max-w-md mx-auto rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Indicators */}
      {products.length > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
          {products.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentSlide === index ? 'bg-white' : 'bg-white/50'
              }`}
              data-testid={`button-carousel-indicator-${index}`}
            />
          ))}
        </div>
      )}

      {/* Navigation Arrows */}
      {products.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/20 text-white hover:bg-black/40 rounded-full z-20"
            data-testid="button-carousel-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/20 text-white hover:bg-black/40 rounded-full z-20"
            data-testid="button-carousel-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}
    </section>
  );
}
