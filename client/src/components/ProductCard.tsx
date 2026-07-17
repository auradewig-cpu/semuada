import { useState } from 'react';
import { Share2, Copy, Check, Star, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductImageCarousel } from '@/components/ProductImageCarousel';
import { useToast } from '@/hooks/use-toast';
import { formatSalesCount } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onProductClick: (productId: string) => void;
}

export function ProductCard({ product, onProductClick }: ProductCardProps) {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const rating = parseFloat(product.rating?.toString() || '0');

  const handleCopyLink = () => {
    if (product.affiliate_url) {
      navigator.clipboard.writeText(product.affiliate_url);
      toast({
        title: 'Tautan disalin!',
        description: 'Tautan produk telah disalin ke clipboard.',
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset icon after 2 seconds
    }
  };

  const shareUrl = product.affiliate_url ? encodeURIComponent(product.affiliate_url) : '';
  const shareText = encodeURIComponent(`Cek produk keren ini: ${product.product_name}`);

  const handleProductRedirect = () => {
    onProductClick(product.id);
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 group flex flex-col product-card">
      <div className="relative overflow-hidden">
        {/* Overlay "HABIS" jika produk tidak tersedia */}
        {(product.stock_available === false || product.stock_available === null) && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
            <span className="text-white text-2xl font-bold uppercase tracking-wider">HABIS</span>
          </div>
        )}
        <ProductImageCarousel
          images={[product.image_url, ...(product.image_urls ?? [])].filter((url): url is string => !!url)}
          alt={product.product_name}
          className="w-full h-48"
        />
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {product.sales && product.sales > 500 && (
            <span className="px-2 py-0.5 bg-yellow text-yellow-foreground rounded-full text-xs font-semibold shadow-lg flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              TERLARIS
            </span>
          )}
          {rating > 4.5 && (
            <span className="px-2 py-0.5 bg-violet text-violet-foreground rounded-full text-xs font-semibold shadow-lg flex items-center gap-1">
              <Award className="h-3 w-3" />
              REKOMENDASI
            </span>
          )}
        </div>

        {/* Discount percentage overlay - bottom left corner */}
        {(() => {
          const currentPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
          const originalPrice = product.original_price ? (typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price) : null;

          if (originalPrice && originalPrice > currentPrice) {
            const discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
            return (
              <div className="absolute bottom-2 left-2">
                <span className="bg-red-500 text-white px-2 py-1 rounded-md text-sm font-bold shadow-lg">
                  -{discountPercent}%
                </span>
              </div>
            );
          }
          return null;
        })()}

        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Bagikan produk"
                className="h-8 w-8 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()} // Prevent card click
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleCopyLink}>
                {isCopied ? (
                  <Check className="mr-2 h-4 w-4 text-emerald" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                <span>Salin Tautan</span>
              </DropdownMenuItem>
              <a
                href={`https://api.whatsapp.com/send?text=${shareText}%0A${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <DropdownMenuItem>
                  <i className="fab fa-whatsapp mr-2 h-4 w-4"></i>
                  <span>WhatsApp</span>
                </DropdownMenuItem>
              </a>
              <a
                href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <DropdownMenuItem>
                  <i className="fab fa-telegram-plane mr-2 h-4 w-4"></i>
                  <span>Telegram</span>
                </DropdownMenuItem>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <DropdownMenuItem>
                  <i className="fab fa-facebook-f mr-2 h-4 w-4"></i>
                  <span>Facebook</span>
                </DropdownMenuItem>
              </a>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-base leading-snug line-clamp-2 mb-2 h-11" title={product.product_name}>
          {product.product_name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2" data-testid={`product-id-${product.id}`}>
          ID: {product.product_id || 'N/A'}
        </p>

        {rating > 0 && (
          <div className="flex items-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Informasi Dikirim Dari, Toko, dan Item */}
        <div className="flex flex-col space-y-1 mb-2">
          {product.dikirim_dari && (
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground mr-1">Dikirim dari:</span>
              <span>{product.dikirim_dari}</span>
            </div>
          )}
          {product.toko && (
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground mr-1">Toko:</span>
              <span>{product.toko}</span>
            </div>
          )}
        </div>

        <div className="flex-grow"></div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2">
          <div>
            {(() => {
              const currentPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
              const originalPrice = product.original_price ? (typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price) : null;

              if (originalPrice && originalPrice > currentPrice) {
                const discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
                return (
                  <div className="flex flex-col">
                    <p className="text-sm text-muted-foreground line-through">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                      }).format(originalPrice)}
                    </p>
                    <p className="text-lg font-bold text-emerald">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                      }).format(currentPrice)}
                    </p>
                    {/* Discount percentage removed from here - now shown as overlay on image */}
                  </div>
                );
              } else {
                return (
                  <p className="text-lg font-bold text-emerald">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(currentPrice)}
                  </p>
                );
              }
            })()}
          </div>
          {product.sales && (
            <span className="text-xs text-muted-foreground mt-1 sm:mt-0">{formatSalesCount(product.sales)} terjual</span>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <Button
          onClick={handleProductRedirect}
          className="w-full bg-gradient-to-r from-emerald to-violet text-white font-semibold shadow-md hover:shadow-lg hover:brightness-110 active:shadow-inner transition-all duration-200 transform group-hover:scale-105"
          disabled={product.stock_available === false || product.stock_available === null}
        >
          Lihat Produk
        </Button>
      </div>
    </div>
  );
}