import { useState } from 'react';
import { Share2, Copy, Check, Star, TrendingUp, Award, MessageCircle, Send, Facebook, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductImageCarousel } from '@/components/ProductImageCarousel';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, formatSalesCount } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onProductClick: (productId: string) => void;
  /** See ProductImageCarousel's `priority` doc -- for above-the-fold cards. */
  priority?: boolean;
  /**
   * compact = Shopee-style mobile card (used by the storefront grids): the
   * whole card is a tap target, no ID line, no full-width CTA, tighter
   * spacing. default keeps the legacy layout with the CTA button.
   */
  variant?: 'default' | 'compact';
}

export function ProductCard({ product, onProductClick, priority, variant = 'default' }: ProductCardProps) {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const rating = parseFloat(product.rating?.toString() || '0');
  const isCompact = variant === 'compact';
  const unavailable = product.stock_available === false || product.stock_available === null;

  const handleCopyLink = () => {
    if (product.affiliate_url) {
      navigator.clipboard.writeText(product.affiliate_url);
      toast({
        title: 'Tautan disalin!',
        description: 'Tautan produk telah disalin ke clipboard.',
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const shareUrl = product.affiliate_url ? encodeURIComponent(product.affiliate_url) : '';
  const shareText = encodeURIComponent(`Cek produk keren ini: ${product.product_name}`);

  const handleProductRedirect = () => {
    if (unavailable) return;
    onProductClick(product.id);
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
    }
  };

  const currentPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  const originalPrice = product.original_price
    ? (typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price)
    : null;

  return (
    <div
      className={`bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 group flex flex-col product-card ${
        isCompact && !unavailable ? 'cursor-pointer' : ''
      }`}
      onClick={isCompact ? handleProductRedirect : undefined}
      role={isCompact ? 'button' : undefined}
      tabIndex={isCompact ? 0 : undefined}
      onKeyDown={
        isCompact
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleProductRedirect();
              }
            }
          : undefined
      }
    >
      <div className="relative overflow-hidden">
        {unavailable && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
            <span className="text-white text-lg md:text-2xl font-bold uppercase tracking-wider">HABIS</span>
          </div>
        )}
        <ProductImageCarousel
          images={[product.image_url, ...(product.image_urls ?? [])].filter((url): url is string => !!url)}
          alt={product.product_name}
          className={`w-full ${isCompact ? 'aspect-square' : 'h-48'}`}
          priority={priority}
        />
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {product.sales && product.sales > 500 && (
            <span className="px-2 py-0.5 bg-yellow text-yellow-foreground rounded-full text-[10px] md:text-xs font-semibold shadow-lg flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              TERLARIS
            </span>
          )}
          {rating > 4.5 && (
            <span className="px-2 py-0.5 bg-violet text-violet-foreground rounded-full text-[10px] md:text-xs font-semibold shadow-lg flex items-center gap-1">
              <Award className="h-3 w-3" />
              REKOMENDASI
            </span>
          )}
        </div>

        {/* Discount badge on the image corner */}
        {originalPrice && originalPrice > currentPrice && (
          <div className="absolute bottom-2 left-2">
            <span className="bg-red-500 text-white px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-xs md:text-sm font-bold shadow-lg">
              -{Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}%
            </span>
          </div>
        )}

        {/* Share button -- small icon; stops propagation so the card tap isn't hijacked. */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Bagikan produk"
                className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleCopyLink}>
                {isCopied ? <Check className="mr-2 h-4 w-4 text-emerald" /> : <Copy className="mr-2 h-4 w-4" />}
                <span>Salin Tautan</span>
              </DropdownMenuItem>
              <a href={`https://api.whatsapp.com/send?text=${shareText}%0A${shareUrl}`} target="_blank" rel="noopener noreferrer" className="w-full">
                <DropdownMenuItem>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>WhatsApp</span>
                </DropdownMenuItem>
              </a>
              <a href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`} target="_blank" rel="noopener noreferrer" className="w-full">
                <DropdownMenuItem>
                  <Send className="mr-2 h-4 w-4" />
                  <span>Telegram</span>
                </DropdownMenuItem>
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer" className="w-full">
                <DropdownMenuItem>
                  <Facebook className="mr-2 h-4 w-4" />
                  <span>Facebook</span>
                </DropdownMenuItem>
              </a>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={`${isCompact ? 'p-3' : 'p-4'} flex flex-col flex-grow`}>
        <h3
          className={`font-semibold leading-snug line-clamp-2 ${isCompact ? 'text-[13px] h-10' : 'text-base h-11'} mb-2`}
          title={product.product_name}
        >
          {product.product_name}
        </h3>

        {!isCompact && (
          <p className="text-xs text-muted-foreground mb-2" data-testid={`product-id-${product.id}`}>
            ID: {product.product_id || 'N/A'}
          </p>
        )}

        {rating > 0 && !isCompact && (
          <div className="flex items-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className={`h-4 w-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
          </div>
        )}

        <div className="flex-grow"></div>

        {/* Price (prominent in compact) */}
        <div className={`${isCompact ? 'mb-1' : 'mt-2 mb-3'}`}>
          {originalPrice && originalPrice > currentPrice ? (
            <div className="flex flex-col">
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </p>
              <p className={`${isCompact ? 'text-base' : 'text-lg'} font-bold text-emerald leading-tight`}>
                {formatPrice(currentPrice)}
              </p>
            </div>
          ) : (
            <p className={`${isCompact ? 'text-base' : 'text-lg'} font-bold text-emerald leading-tight`}>
              {formatPrice(currentPrice)}
            </p>
          )}
        </div>

        {/* Compact micro-row: terjual · lokasi */}
        {isCompact ? (
          <p className="text-[11px] text-muted-foreground truncate">
            {product.sales ? `${formatSalesCount(product.sales)} terjual` : ''}
            {product.sales && product.dikirim_dari ? ' · ' : ''}
            {product.dikirim_dari ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {product.dikirim_dari}
              </span>
            ) : (
              ''
            )}
          </p>
        ) : (
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
        )}

        {!isCompact && (
          <>
            <div className="flex-grow"></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2">
              {product.sales && <span className="text-xs text-muted-foreground">{formatSalesCount(product.sales)} terjual</span>}
            </div>
          </>
        )}
      </div>

      {!isCompact && (
        <div className="p-4 pt-0">
          <Button
            onClick={handleProductRedirect}
            className="w-full bg-gradient-to-r from-emerald to-violet text-white font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-200"
            disabled={unavailable}
          >
            Lihat Produk
          </Button>
        </div>
      )}
    </div>
  );
}
