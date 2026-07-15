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
