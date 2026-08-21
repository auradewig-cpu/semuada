import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice)) {
    return 'Invalid price';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericPrice);
}

export function calculateDiscount(price: number, originalPrice: number): number {
  if (originalPrice <= 0 || price >= originalPrice) {
    return 0;
  }
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/** Formats a sales count Shopee-style: 7000 -> "7RB+", 1500000 -> "1JT+". */
export function formatSalesCount(sales: number | string | null | undefined): string {
  const n = typeof sales === 'string' ? parseInt(sales, 10) : sales;
  if (!n || isNaN(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}JT+`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}RB+`;
  return String(n);
}

/**
 * Display form for `products.dikirim_dari`, which the scraper stores in caps
 * ("KOTA SURAKARTA (SOLO)"). Title case is not decoration here: measured in
 * the real font (Inter 11px), caps runs ~22% wider, and at the 130px of card
 * width a 360px phone leaves, 5 of the 45 real values -- including KOTA
 * TANGERANG SELATAN -- no longer fit. Title case makes all 45 fit.
 *
 * Capitalises after a space, a "." and a "(" rather than per word, because
 * all three separators occur in the data: "KAB. CIREBON" -> "Kab. Cirebon",
 * "KOTA SURAKARTA (SOLO)" -> "Kota Surakarta (Solo)". deslugify() below only
 * splits on spaces, which would leave "kab." and "(solo)" lowercase.
 *
 * Display layer only -- the stored value is untouched.
 */
export function formatShippingOrigin(origin: string | null | undefined): string {
  if (!origin) return '';
  let result = '';
  let atBoundary = true;
  for (const char of origin.toLowerCase()) {
    result += atBoundary ? char.toUpperCase() : char;
    atBoundary = char === ' ' || char === '.' || char === '(';
  }
  return result;
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/&/g, '-and-')         // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

export function deslugify(slug: string): string {
  if (!slug) return '';
  const words = slug.replace(/-/g, ' ').split(' ');
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
