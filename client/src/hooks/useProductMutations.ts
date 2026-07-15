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
  is_featured: z.boolean().default(false),
  featured_order: z.coerce.number().optional(),
  rating: z.coerce.number().optional(),
  stock_available: z.boolean().default(true),
});

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: z.infer<typeof productFormSchema>) => {
      const res = await apiRequest('POST', '/api/products', newProduct);
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
      const res = await apiRequest('PUT', `/api/products/${id}`, updateData);
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
