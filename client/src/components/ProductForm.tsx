
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Product } from "@/types";

// Define the form schema using Zod
const formSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().min(3, "Product name must be at least 3 characters"),
  category: z.string().min(2, "Category is required"),
  subcategory: z.string().optional(),
  original_price: z.coerce.number().min(0, "Original price must be a positive number").optional(),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  sales: z.coerce.number().min(0, "Sales must be a positive number").optional(),
  affiliate_url: z.string().url("Must be a valid URL"),
  image_url: z.string().url("Must be a valid URL"),
  image_url_2: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  image_url_3: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  image_url_4: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  image_url_5: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  is_featured: z.boolean().optional().default(false),
  featured_order: z.coerce.number().optional(),
  rating: z.coerce.number().optional(),
  commission: z.coerce.number().min(0, "Commission must be a positive number").optional(),
  dikirim_dari: z.string().optional(),
  toko: z.string().optional(),
  stock_available: z.boolean().default(true),
});

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
}

export function ProductForm({ product, onSubmit, isSubmitting }: ProductFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: product?.product_id || "",
      product_name: product?.product_name || "",
      category: product?.category || "",
      subcategory: product?.subcategory || "",
      original_price: product?.original_price != null ? (typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price) : undefined,
      price: product?.price ? (typeof product.price === 'string' ? parseFloat(product.price) : product.price) : 0,
      sales: product?.sales || 0,
      affiliate_url: product?.affiliate_url || "",
      image_url: product?.image_url || "",
      image_url_2: product?.image_urls?.[0] || "",
      image_url_3: product?.image_urls?.[1] || "",
      image_url_4: product?.image_urls?.[2] || "",
      image_url_5: product?.image_urls?.[3] || "",
      is_featured: product?.is_featured || false,
      featured_order: product?.featured_order || 0,
      commission: product?.commission != null ? (typeof product.commission === 'string' ? parseFloat(product.commission) : product.commission) : 0,
      dikirim_dari: product?.dikirim_dari || "",
      toko: product?.toko || "",
      stock_available: product?.stock_available ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product ID</FormLabel>
              <FormControl>
                <Input placeholder="e.g. PROD-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="product_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Wireless Headphones" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Electronics" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategory</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Laptops" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="original_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Price</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Leave empty if no discount" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sales"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Sold</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 150" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commission"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Komisi (%)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dikirim_dari"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dikirim Dari</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Jakarta" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toko"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Toko</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Toko ABC" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (foto ke-1)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/image.jpg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormDescription>
          Foto ke-2 sampai ke-5 opsional -- kalau diisi, produk tampil sebagai carousel yang bisa digeser di homepage.
        </FormDescription>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="image_url_2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foto ke-2 (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/image2.jpg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image_url_3"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foto ke-3 (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/image3.jpg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image_url_4"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foto ke-4 (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/image4.jpg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image_url_5"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foto ke-5 (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/image5.jpg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="affiliate_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Affiliate URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/product/123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_featured"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Featured Product</FormLabel>
                <FormDescription>
                  Display this product in the featured carousel on the homepage.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="stock_available"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Ketersediaan Stok</FormLabel>
                <FormDescription>
                  Atur apakah produk ini tersedia atau habis.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
