import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { Product, FilterState, CategoryHierarchy } from '@/types';
import { apiRequest } from '@/lib/queryClient';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// Fisher-Yates shuffle algorithm for random sorting
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function useProducts(filters?: FilterState) {
  return useQuery<Product[]>({
    queryKey: ['products', filters],
    queryFn: async () => {
      let allProducts = await fetchJson<Product[]>('/api/products/all');

      let processedData = allProducts;

      if (filters?.search) {
        const searchTerms = filters.search.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
        if (searchTerms.length > 0) {
          processedData = processedData.filter(product => {
            const productName = product.product_name?.toLowerCase() || '';
            return searchTerms.every(term => productName.includes(term));
          });
        }
      }

      if (filters?.categories && filters.categories.length > 0) {
        processedData = processedData.filter(product =>
          filters.categories!.includes(product.category)
        );
      }

      if (filters?.priceMin !== undefined) {
        processedData = processedData.filter(product =>
          Number(product.price) >= filters.priceMin!
        );
      }
      if (filters?.priceMax !== undefined) {
        processedData = processedData.filter(product =>
          Number(product.price) <= filters.priceMax!
        );
      }

      if (filters?.dikirim_dari) {
        processedData = processedData.filter(product =>
          product.dikirim_dari === filters.dikirim_dari
        );
      }

      if (filters?.item) {
        processedData = processedData.filter(product =>
          (product as any).item === filters.item
        );
      }

      if (filters?.sortBy === 'popular') {
        processedData.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
      } else if (filters?.sortBy === 'terlaris') {
        processedData.sort((a, b) => (b.sales || 0) - (a.sales || 0));
      } else if (filters?.sortBy === 'harga_termurah') {
        processedData.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (filters?.sortBy === 'harga_tertinggi') {
        processedData.sort((a, b) => Number(b.price) - Number(a.price));
      } else if (filters?.sortBy === 'rekomendasi') {
        processedData = shuffleArray(processedData);
      }
      // Default sort is already applied (created_at desc)

      return processedData;
    },
    staleTime: 0,
    gcTime: 0,
  });
}

const PRODUCTS_PER_PAGE = 20;

export function useInfiniteProducts(filters?: FilterState) {
  return useInfiniteQuery<Product[]>({
    queryKey: ['products-infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * PRODUCTS_PER_PAGE;
      const search = new URLSearchParams();
      if (filters?.category) search.set('category', filters.category);
      if (filters?.subcategory) search.set('subcategory', filters.subcategory);
      if (filters?.dikirim_dari) search.set('dikirimDari', filters.dikirim_dari);
      if (filters?.item) search.set('item', filters.item);
      if (filters?.search) search.set('search', filters.search);
      if (filters?.categories && filters.categories.length > 0) search.set('categories', filters.categories.join(','));
      if (filters?.priceMin !== undefined) search.set('priceMin', String(filters.priceMin));
      if (filters?.priceMax !== undefined) search.set('priceMax', String(filters.priceMax));
      if (filters?.sortBy) search.set('sort', filters.sortBy);
      search.set('limit', String(PRODUCTS_PER_PAGE));
      search.set('offset', String(offset));

      const { items } = await fetchJson<{ items: Product[]; nextOffset: number | null }>(`/api/products?${search.toString()}`);
      return items;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PRODUCTS_PER_PAGE) {
        return undefined;
      }
      return allPages.length;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useFeaturedProducts(category?: string) {
  return useQuery<Product[]>({
    queryKey: ['featuredProducts', category],
    queryFn: async () => {
      const search = new URLSearchParams({ featured: 'true', limit: '100' });
      if (category) search.set('category', category);
      const { items } = await fetchJson<{ items: Product[] }>(`/api/products?${search.toString()}`);
      return items;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useLatestProducts(limit: number = 4) {
  return useQuery<Product[]>({
    queryKey: ['latestProducts', limit],
    queryFn: async () => {
      const search = new URLSearchParams({ sort: 'newest', limit: String(limit) });
      const { items } = await fetchJson<{ items: Product[] }>(`/api/products?${search.toString()}`);
      return items;
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

export function useCategories() {
  return useQuery<CategoryHierarchy>({
    queryKey: ['categoryHierarchy'],
    queryFn: async () => {
      const data = await fetchJson<Record<string, string[]>>('/api/categories');
      const hierarchy = new Map<string, Set<string>>();
      for (const [category, subcategories] of Object.entries(data)) {
        hierarchy.set(category, new Set(subcategories));
      }
      return hierarchy;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useNonFeaturedProducts() {
  return useQuery<Product[]>({
    queryKey: ['nonFeaturedProducts'],
    queryFn: async () => {
      const search = new URLSearchParams({ nonFeatured: 'true', limit: '1000' });
      const { items } = await fetchJson<{ items: Product[] }>(`/api/products?${search.toString()}`);
      return items;
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export function usePengirimanOptions() {
  return useQuery<string[]>({
    queryKey: ['pengirimanOptions'],
    queryFn: () => fetchJson<string[]>('/api/options/dikirim-dari'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useItemOptions() {
  return useQuery<string[]>({
    queryKey: ['itemOptions'],
    queryFn: () => fetchJson<string[]>('/api/options/item'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useItemOptionsByCategory(category?: string, subcategory?: string) {
  return useQuery<string[]>({
    queryKey: ['itemOptionsByCategory', category, subcategory],
    queryFn: () => {
      const search = new URLSearchParams();
      if (category) search.set('category', category);
      if (subcategory) search.set('subcategory', subcategory);
      return fetchJson<string[]>(`/api/options/item?${search.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(category || subcategory),
  });
}

export function useTrackProductClick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productUuid: string) => {
      const res = await apiRequest('POST', `/api/products/${productUuid}/click`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}
