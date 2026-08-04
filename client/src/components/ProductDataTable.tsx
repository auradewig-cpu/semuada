import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Star, Copy, Download, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product } from "@/types";
import { formatPrice, slugify } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductDataTableProps {
  products: Product[];
  selectedProductIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onGenerateRating: (product: Product) => void;
}

export function ProductDataTable({
  products,
  selectedProductIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onGenerateRating,
}: ProductDataTableProps) {
  const { toast } = useToast();
  const [downloadingProductId, setDownloadingProductId] = React.useState<string | null>(null);

  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? products.map(p => p.id) : []);
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedProductIds, id]
      : selectedProductIds.filter(selectedId => selectedId !== id);
    onSelectionChange(newSelection);
  };

  const handleCopyName = (product: Product) => {
    navigator.clipboard.writeText(product.product_name);
    toast({ title: "Disalin", description: "Nama produk disalin ke clipboard." });
  };

  const handleDownloadImages = async (product: Product) => {
    const urls = [product.image_url, ...(product.image_urls ?? [])].filter((url): url is string => !!url);
    if (urls.length === 0) {
      toast({ variant: "destructive", title: "Tidak ada gambar", description: "Produk ini tidak punya gambar." });
      return;
    }

    setDownloadingProductId(product.id);
    const filename = `${slugify(product.product_name)}-images.zip`;
    try {
      const res = await apiRequest("POST", "/api/products/images-zip", { urls, filename });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Berhasil", description: `${urls.length} gambar berhasil didownload.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal download",
        description: error instanceof Error ? error.message : "Terjadi kesalahan.",
      });
    } finally {
      setDownloadingProductId(null);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={selectedProductIds.length === products.length && products.length > 0}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Foto</TableHead>
            <TableHead>Product ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Komisi</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Video URL</TableHead>
            <TableHead>Dikirim Dari</TableHead>
            <TableHead>Toko</TableHead>
            <TableHead className="hidden md:table-cell">Price</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products?.length ? (
            products.map((product) => (
              <TableRow key={product.id} data-state={selectedProductIds.includes(product.id) && "selected"}>
                <TableCell>
                  <Checkbox
                    checked={selectedProductIds.includes(product.id)}
                    onCheckedChange={(checked) => handleRowSelect(product.id, !!checked)}
                    aria-label={`Select row ${product.id}`}
                  />
                </TableCell>
                <TableCell>
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.product_name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{product.product_id || 'N/A'}</TableCell>
                <TableCell className="font-medium">{product.product_name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{product.rating || 'N/A'}</TableCell>
                <TableCell>{product.commission ? formatPrice(product.commission) : 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate">{(product as any).item || 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate">{(product as any).video_url ? '✓' : 'N/A'}</TableCell>
                <TableCell>{product.dikirim_dari || 'N/A'}</TableCell>
                <TableCell>{product.toko || 'N/A'}</TableCell>
                <TableCell className="hidden md:table-cell">{formatPrice(product.price)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onEdit(product)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onGenerateRating(product)}>
                        <Star className="mr-2 h-4 w-4" />
                        Generate Rating
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleCopyName(product)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Salin Nama Produk
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleDownloadImages(product)}
                        disabled={downloadingProductId === product.id}
                      >
                        {downloadingProductId === product.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download Semua Gambar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onDelete(product)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={13} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}