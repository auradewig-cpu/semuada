import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import * as z from "zod";

export const productFormSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().min(3),
  category: z.string().min(2),
  subcategory: z.string().optional(),
  original_price: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0),
  sales: z.coerce.number().min(0).optional(),
  commission: z.coerce.number().min(0).optional(),
  dikirim_dari: z.string().optional(),
  toko: z.string().optional(),
  item: z.string().optional(),
  video_url: z.string().optional(),
  affiliate_url: z.string().url(),
  image_url: z.string().url(),
  image_url_2: z.string().url().optional().or(z.literal('')),
  image_url_3: z.string().url().optional().or(z.literal('')),
  image_url_4: z.string().url().optional().or(z.literal('')),
  image_url_5: z.string().url().optional().or(z.literal('')),
  is_featured: z.boolean().default(false),
  featured_order: z.coerce.number().optional(),
  rating: z.coerce.number().optional(),
  stock_available: z.boolean().default(true),
});

const IMAGE_URL_KEYS = ['image_url_2', 'image_url_3', 'image_url_4', 'image_url_5'] as const;

function buildImageUrls(values: Partial<z.infer<typeof productFormSchema>>): string[] {
  return IMAGE_URL_KEYS.map((key) => values[key]).filter((url): url is string => !!url);
}

/** True if the caller actually touched any of the image_url_2..5 fields --
 * used to avoid wiping out existing gallery images on partial updates
 * (e.g. FeaturedManagementTab only toggling `is_featured`). */
function touchesImageUrls(values: Partial<z.infer<typeof productFormSchema>>): boolean {
  return IMAGE_URL_KEYS.some((key) => key in values);
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: z.infer<typeof productFormSchema>) => {
      const { image_url_2, image_url_3, image_url_4, image_url_5, ...rest } = newProduct;
      const payload = { ...rest, image_urls: buildImageUrls(newProduct) };
      const res = await apiRequest('POST', '/api/products', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['featuredProducts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['nonFeaturedProducts'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Partial<z.infer<typeof productFormSchema>>) => {
      const { image_url_2, image_url_3, image_url_4, image_url_5, ...rest } = updateData;
      const payload: Record<string, unknown> = { ...rest };
      // Only touch image_urls when the caller actually provided those fields --
      // partial updates (e.g. toggling is_featured) must not wipe the gallery.
      if (touchesImageUrls(updateData)) {
        payload.image_urls = buildImageUrls(updateData);
      }
      const res = await apiRequest('PUT', `/api/products/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['featuredProducts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['nonFeaturedProducts'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['featuredProducts'] });
    },
  });
}
