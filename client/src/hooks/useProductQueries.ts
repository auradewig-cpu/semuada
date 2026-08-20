import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import type { Product, FilterState } from '@/types';
import type { ProductFilters } from '@root/lib/productFilters';
import { filtersToApiQuery, buildInitialFilters } from '@root/lib/productFilters';
import { apiRequest } from '@/lib/queryClient';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// One seed per client session makes sort=rekomendasi a stable shuffle across
// pages (GET /api/products orders by md5(id || seed) before pagination). Module
// scope: generated once per browser session, persisted so a refresh keeps the
// same order for the session. SSR (no window) falls back to 'default'.
const SESSION_SEED =
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
    ? (window.sessionStorage.getItem('catalogSeed') ??
      (() => {
        const s = Math.random().toString(36).slice(2);
        window.sessionStorage.setItem('catalogSeed', s);
        return s;
      })())
    : 'default';

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
      }
      // Default sort is already applied (created_at desc)

      return processedData;
    },
    staleTime: 0,
    gcTime: 0,
  });
}

// Exported so app/page.tsx can prefetch a first page server-side with the
// exact same page size the client's useInfiniteQuery expects.
export const PRODUCTS_PER_PAGE = 20;

export function useInfiniteProducts(filters?: ProductFilters) {
  return useInfiniteQuery<Product[]>({
    queryKey: ['products-infinite', filters ?? buildInitialFilters()],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * PRODUCTS_PER_PAGE;
      const search = filtersToApiQuery(filters ?? buildInitialFilters(), {
        limit: PRODUCTS_PER_PAGE,
        offset,
      });
      search.set('seed', SESSION_SEED);

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
    // Changing a filter keeps the previous results on screen (no empty-grid
    // skeleton flash) while the new page loads.
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // Every route that renders this grid prefetches its first page server-side
    // (app/page.tsx, app/[category]/**). Those pages are ISR-cached, so their
    // dehydrated dataUpdatedAt is the prerender time -- always "stale" by the
    // time a visitor mounts, which made react-query re-fetch page 0 over HTTP
    // on EVERY page view purely to get back what the RSC payload had already
    // delivered. Freshness is the server's job here (revalidate = 60).
    // Filter/sort combinations that were never prefetched have no cached data
    // at all, so they still fetch normally -- this only suppresses the
    // redundant re-fetch of already-hydrated data.
    refetchOnMount: false,
  });
}

export function useBestSellers(limit: number = 10) {
  return useQuery<Product[]>({
    queryKey: ['bestSellers', limit],
    queryFn: async () => {
      const search = new URLSearchParams({ sort: 'terlaris', limit: String(limit) });
      const { items } = await fetchJson<{ items: Product[] }>(`/api/products?${search.toString()}`);
      return items;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // Homepage prefetches it server-side; suppress the redundant re-fetch.
    refetchOnMount: false,
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
    // Same reasoning as useInfiniteProducts -- and this one is the expensive
    // case, since it pulls up to 100 full product rows.
    refetchOnMount: false,
  });
}

// Returns the raw JSON shape (not a Map<string, Set<string>>) so this query's
// cache data stays safe to hydrate through app/page.tsx's Server -> Client
// Component boundary (dehydrate()/HydrationBoundary) -- Map/Set aren't safe
// to pass across that boundary. Consumers that want the Map<Set> shape (e.g.
// CategoryContext) derive it locally via useMemo instead.
export function useCategories() {
  return useQuery<Record<string, string[]>>({
    queryKey: ['categoryHierarchy'],
    queryFn: () => fetchJson<Record<string, string[]>>('/api/categories'),
    staleTime: 1000 * 60 * 10,
    // Same reasoning as useInfiniteProducts: app/layout.tsx prefetches this on
    // every route, and an ISR page served from cache carries a prerender-time
    // dataUpdatedAt, so without this the hierarchy was refetched over HTTP on
    // page views of any page older than the staleTime.
    refetchOnMount: false,
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

// "Lokasi" filter options: {value, count} ordered by count desc, scoped to the
// category/subcategory so a category page only surfaces the locations present
// in it (previously every page showed all 46 regardless).
export function useLocationOptions(category?: string, subcategory?: string) {
  return useQuery<{ value: string; count: number }[]>({
    queryKey: ['locationOptions', category, subcategory],
    queryFn: () => {
      const search = new URLSearchParams();
      if (category) search.set('category', category);
      if (subcategory) search.set('subcategory', subcategory);
      return fetchJson<{ value: string; count: number }[]>(`/api/options/dikirim-dari?${search.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
    // The category pages prefetch this into the same key (see their
    // setQueryData calls); without this the ISR-aged dataUpdatedAt made every
    // visit refetch it anyway. /cari has no prefetch, so it still fetches.
    refetchOnMount: false,
  });
}

export function useItemOptionsByCategory(category?: string, subcategory?: string) {
  return useQuery<{ value: string; count: number }[]>({
    queryKey: ['itemOptionsByCategory', category, subcategory],
    queryFn: () => {
      const search = new URLSearchParams();
      if (category) search.set('category', category);
      if (subcategory) search.set('subcategory', subcategory);
      return fetchJson<{ value: string; count: number }[]>(`/api/options/item?${search.toString()}`);
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
