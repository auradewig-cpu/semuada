export interface Product {
  id: string;
  product_id: string | null;
  product_name: string;
  price: string | number;
  original_price?: string | number | null;
  sales: number | null;
  category: string;
  subcategory: string | null;
  item?: string | null; // Additional field from database
  affiliate_url: string | null;
  image_url: string | null;
  image_urls?: string[] | null; // Foto ke-2 s/d ke-5 (foto pertama tetap di image_url)
  video_url?: string | null; // Additional field from database
  rating: number | null;
  commission: string | number | null;
  komisi?: string | number | null; // Database field name
  dikirim_dari: string | null;
  toko: string | null;
  is_featured: boolean | null;
  featured_order: number | null;
  created_at: string | null;
  stock_available: boolean | null;
  clicks?: number; // For analytics
}

export interface ProductAnalytics {
  id: string;
  productId: string;
  eventType: string;
  createdAt: string | null;
}

export interface Settings {
  id: string;
  showCategoryFilter: boolean | null;
  updatedAt: string | null;
  facebook_pixel_id?: string | null;
  google_analytics_id?: string | null;
}

export interface FilterState {
  search: string;
  priceMin: number;
  priceMax: number;
  sortBy: string;
  category?: string;
  subcategory?: string;
  categories?: string[];
  dikirim_dari?: string;
  item?: string;
}

export type CategoryHierarchy = Map<string, Set<string>>;

