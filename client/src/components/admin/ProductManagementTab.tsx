import { useState, useRef, useEffect } from 'react';
import * as z from "zod";
import { Plus, Upload, Trash2, Star, Edit, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProductQueries';
import {
  useAddProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/useProductMutations';
import { ProductDataTable } from '@/components/ProductDataTable';
import { ProductForm } from '@/components/ProductForm';
import { BulkUpdateDialog } from './BulkUpdateDialog';
import type { Product } from '@/types';
import { CSVLink } from 'react-csv';
import Papa from 'papaparse';
import { Input } from '@/components/ui/input';

const productFormSchema = z.object({
  // Allow empty string, then transform to undefined for consistency
  product_id: z.string().optional().transform(val => val === "" ? undefined : val),
  product_name: z.string().min(3),
  category: z.string().min(2),
  subcategory: z.string().optional().transform(val => val === "" ? undefined : val),
  // Coerce to number, allow it to be optional or null
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
  rating: z.coerce.number().min(0).max(5).optional(),
  stock_available: z.boolean().default(true),
});

export function ProductManagementTab() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [csvExportData, setCsvExportData] = useState<any[]>([]);
  const [searchById, setSearchById] = useState('');
  const [searchByName, setSearchByName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Show 50 products per page for better performance
  const csvLinkRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear any large data structures when component unmounts
      setCsvExportData([]);
    };
  }, []);

  const { data: allProducts = [], isLoading: isLoadingProducts } = useProducts();

  // Implement pagination
  const totalPages = Math.ceil(allProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const products = allProducts.slice(startIndex, endIndex);

  // Debug logging to check total products
  console.log('Total products in database:', products.length);
  console.log('First 5 products:', products.slice(0, 5).map(p => ({ id: p.id, name: p.product_name, productId: p.product_id })));

  // Check if we have all 1131 products
  if (products.length > 0 && products.length < 1131) {
    console.log('WARNING: Only', products.length, 'products loaded, expected 1131. The fix may not be working yet.');
  } else if (products.length >= 1131) {
    console.log('SUCCESS: All', products.length, 'products loaded successfully!');
  }
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const filteredProducts = products.filter(product => {
    const idQuery = searchById.toLowerCase().trim();
    const nameQuery = searchByName.toLowerCase().trim();

    const productName = product.product_name?.toLowerCase() || '';
    const productId = product.product_id?.toLowerCase() || '';

    // Split search queries into individual terms for better matching
    const idTerms = idQuery ? idQuery.split(/\s+/).filter(term => term.length > 0) : [];
    const nameTerms = nameQuery ? nameQuery.split(/\s+/).filter(term => term.length > 0) : [];

    // Check if product matches ID search terms (all terms must be present)
    const matchesId = idTerms.length === 0 || idTerms.every(term => productId.includes(term));

    // Check if product matches name search terms (all terms must be present)
    const matchesName = nameTerms.length === 0 || nameTerms.every(term => productName.includes(term));

    return matchesId && matchesName;
  });


  const handleAddClick = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedProductIds([]); // Clear bulk selection
    setIsDeleteConfirmOpen(true);
  };

  const handleBulkDeleteClick = () => {
    setSelectedProduct(null); // Clear single selection
    setIsDeleteConfirmOpen(true);
  };

  const handleBulkGenerateRating = async () => {
    if (selectedProductIds.length === 0) return;

    const possibleRatings = [4, 4.5, 5];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < selectedProductIds.length; i += batchSize) {
      const batch = selectedProductIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (id) => {
        try {
          const randomRating = possibleRatings[Math.floor(Math.random() * possibleRatings.length)];
          // Find the product to preserve existing item and video_url values
          const product = allProducts.find(p => p.id === id);
          await updateProduct.mutateAsync({
            id,
            rating: randomRating,
            item: product?.item || '', // Preserve existing item value
            video_url: product?.video_url || '', // Preserve existing video_url value
          });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Product ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises);
    }

    // Show results
    if (errorCount === 0) {
      toast({
        title: "Success",
        description: `${successCount} product(s) ratings generated successfully.`
      });
    } else if (successCount === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to generate ratings for ${errorCount} product(s).`
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} ratings generated, ${errorCount} failed. Check console for details.`
      });
      console.error('Bulk rating generation errors:', errors);
    }

    setSelectedProductIds([]);
  };

  const handleBulkUpdateClick = () => {
    setIsBulkUpdateDialogOpen(true);
  };

  const handleBulkUpdateSubmit = async (dataFromDialog: { [key: string]: any }) => {
    if (selectedProductIds.length === 0) return;

    // Map camelCase from dialog form to snake_case for the database
    const mappedData = {
      product_name: dataFromDialog.productName,
      category: dataFromDialog.category,
      subcategory: dataFromDialog.subcategory,
      price: dataFromDialog.price,
      sales: dataFromDialog.sales,
      item: (dataFromDialog as any).item || '', // Include item field
      commission: dataFromDialog.commission, // Use 'commission' for database compatibility
      dikirim_dari: dataFromDialog.dikirim_dari,
      toko: dataFromDialog.toko,
      affiliate_url: dataFromDialog.affiliateUrl,
      image_url: dataFromDialog.imageUrl,
      video_url: (dataFromDialog as any).video_url || '', // Include video_url field
      // Note: is_featured not in current database schema
    };

    // The dialog already filters out empty/null values, but this also removes any keys
    // that were undefined in the mapping (i.e., not present in the dialog form data).
    const updatePayload = Object.fromEntries(
      Object.entries(mappedData).filter(([, value]) => value !== undefined)
    );

    // If no fields were actually filled out, do nothing.
    if (Object.keys(updatePayload).length === 0) {
      toast({
        variant: "default",
        title: "No changes",
        description: "You did not enter any values to update.",
      });
      setIsBulkUpdateDialogOpen(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches to avoid overwhelming the server
    const batchSize = 5; // Smaller batch size for updates
    for (let i = 0; i < selectedProductIds.length; i += batchSize) {
      const batch = selectedProductIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (id) => {
        try {
          await updateProduct.mutateAsync({ id, ...updatePayload });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Product ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises);
    }

    // Show results
    if (errorCount === 0) {
      toast({
        title: "Success",
        description: `${successCount} product(s) updated successfully.`
      });
    } else if (successCount === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update ${errorCount} product(s).`
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} products updated, ${errorCount} failed. Check console for details.`
      });
      console.error('Bulk update errors:', errors);
    }

    setIsBulkUpdateDialogOpen(false);
    setSelectedProductIds([]);
  };

  const confirmDelete = async () => {
    const idsToDelete = selectedProductIds.length > 0 ? selectedProductIds : (selectedProduct ? [selectedProduct.id] : []);
    if (idsToDelete.length === 0) return;

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process deletions in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);

      const batchPromises = batch.map(async (id) => {
        try {
          await deleteProduct.mutateAsync(id);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Product ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises);
    }

    // Show results
    if (errorCount === 0) {
      toast({
        title: "Success",
        description: `${successCount} product(s) deleted successfully.`
      });
    } else if (successCount === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete ${errorCount} product(s).`
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} products deleted, ${errorCount} failed. Check console for details.`
      });
      console.error('Bulk delete errors:', errors);
    }

    setIsDeleteConfirmOpen(false);
    setSelectedProductIds([]);
  };

  const handleFormSubmit = (values: z.infer<typeof productFormSchema>) => {
    const possibleRatings = [4, 4.5, 5];
    const randomRating = possibleRatings[Math.floor(Math.random() * possibleRatings.length)];

    if (selectedProduct) {
      updateProduct.mutate({ id: selectedProduct.id, ...values }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Product updated successfully." });
          setIsFormOpen(false);
          setSelectedProduct(null); // Clear selected product after successful update
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Error", description: error.message });
        },
      });
    } else {
      addProduct.mutate({ ...values, rating: randomRating }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Product added successfully." });
          setIsFormOpen(false);
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Error", description: error.message });
        },
      });
    }
  };
  
  const handleGenerateRating = (product: Product) => {
    const possibleRatings = [4, 4.5, 5];
    const randomRating = possibleRatings[Math.floor(Math.random() * possibleRatings.length)];

    // Preserve existing item and video_url values when updating rating
    updateProduct.mutate({
      id: product.id,
      rating: randomRating,
      item: product.item || '', // Preserve existing item value
      video_url: product.video_url || '', // Preserve existing video_url value
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: `Generated new rating for ${product.product_name}.` });
      },
      onError: (error) => {
        console.error('Error updating rating:', error);
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const handleExport = () => {
    const headers = [
      { label: "product_id", key: "product_id" },
      { label: "product_name", key: "product_name" },
      { label: "price", key: "price" },
      { label: "sales", key: "sales" },
      { label: "category", key: "category" },
      { label: "subcategory", key: "subcategory" },
      { label: "item", key: "item" },
      { label: "affiliate_url", key: "affiliate_url" },
      { label: "image_url", key: "image_url" },
      { label: "image_url_2", key: "image_url_2" },
      { label: "image_url_3", key: "image_url_3" },
      { label: "image_url_4", key: "image_url_4" },
      { label: "image_url_5", key: "image_url_5" },
      { label: "video_url", key: "video_url" },
      { label: "original_price", key: "original_price" },
      { label: "dikirim_dari", key: "dikirim_dari" },
      { label: "toko", key: "toko" },
      { label: "komisi", key: "commission" },
      { label: "is_featured", key: "is_featured" },
      { label: "featured_order", key: "featured_order" },
      { label: "rating", key: "rating" },
      { label: "stock_available", key: "stock_available" },
    ];

    // Create a copy of all products data to export everything
    // Map database fields to CSV headers, using 'komisi' for commission
    const exportData = allProducts.map(product => ({
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category,
      subcategory: product.subcategory,
      original_price: product.original_price,
      price: product.price,
      sales: product.sales,
      item: (product as any).item || '', // Include item field
      komisi: product.commission, // Use 'komisi' for CSV export to match database
      dikirim_dari: product.dikirim_dari,
      toko: product.toko,
      affiliate_url: product.affiliate_url,
      image_url: product.image_url,
      image_url_2: product.image_urls?.[0] || '',
      image_url_3: product.image_urls?.[1] || '',
      image_url_4: product.image_urls?.[2] || '',
      image_url_5: product.image_urls?.[3] || '',
      video_url: (product as any).video_url || '', // Include video_url field
      // Note: is_featured, featured_order, rating, stock_available not in current database
    }));

    setCsvExportData(exportData);

    // Clear the data after a delay to prevent memory leaks
    setTimeout(() => {
      setCsvExportData([]);
      if (csvLinkRef.current?.link) {
        csvLinkRef.current.link.click();
      }
    }, 100);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as any[];
        let successfulImports = 0;
        let failedImports = 0;

        const importPromises = parsedData.map(async (item, index) => {
           console.log(`[DEBUG] Row ${index + 2} - Processing product: ${item.product_name?.substring(0, 50)}...`);

          // Map CSV column names to database field names
          const mappedItem = {
            ...item,
            // Map "komisi" from CSV/database to "commission" for schema compatibility
            commission: item.komisi ? parseFloat(item.komisi) : (item.commission ? parseFloat(item.commission) : 0),
            // Ensure other fields are properly mapped (provide defaults if missing)
            dikirim_dari: item.dikirim_dari || '',
            toko: item.toko || '',
            item: item.item || item.Item || '', // Map item field (try both cases)
            video_url: item.video_url || item.videoUrl || item.Video_Url || '', // Map video_url field (try multiple variations)
            // Ensure numeric fields are parsed as numbers
            price: item.price ? parseFloat(item.price) : 0,
            original_price: item.original_price ? parseFloat(item.original_price) : undefined,
            sales: item.sales ? parseInt(item.sales) : 0,
            rating: item.rating ? parseFloat(item.rating) : undefined,
            featured_order: item.featured_order ? parseInt(item.featured_order) : undefined,
            // Handle missing columns with defaults
            is_featured: item.is_featured !== undefined ? item.is_featured : false,
            stock_available: item.stock_available !== undefined ? item.stock_available : true,
          };

          // Remove the original "komisi" key if it exists to avoid conflicts
          if (mappedItem.hasOwnProperty('komisi')) {
            delete (mappedItem as any).komisi;
          }

          // Remove any undefined values to clean up the data
          Object.keys(mappedItem).forEach(key => {
            if (mappedItem[key] === undefined) {
              delete mappedItem[key];
            }
          });

          // console.log(`[DEBUG] Row ${index + 2} - Mapped data:`, mappedItem);

          // Use schema to validate and parse each row
          const validationResult = productFormSchema.safeParse(mappedItem);

          console.log(`[DEBUG] Row ${index + 2} - Validation:`, validationResult.success ? 'SUCCESS' : 'FAILED');
          if (!validationResult.success) {
            console.log(`[DEBUG] Row ${index + 2} - Validation errors:`, validationResult.error.errors);
          }

          if (validationResult.success) {
            // Ensure required fields are present and clean undefined values
            // Only include fields that exist in the actual database schema
            const data = validationResult.data;
            const cleanData = {
              product_name: data.product_name,
              category: data.category,
              price: data.price,
              affiliate_url: data.affiliate_url,
              image_url: data.image_url,
              // Map commission to commission for database compatibility
              commission: data.commission || 0,
              dikirim_dari: data.dikirim_dari || '',
              toko: data.toko || '',
              item: data.item || '', // Include item field
              video_url: data.video_url || '', // Include video_url field
              is_featured: data.is_featured ?? false,
              stock_available: data.stock_available ?? true,
              ...(data.product_id && { product_id: data.product_id }),
              ...(data.subcategory && { subcategory: data.subcategory }),
              ...(data.original_price !== undefined && { original_price: data.original_price }),
              ...(data.sales !== undefined && { sales: data.sales }),
              ...(data.featured_order !== undefined && { featured_order: data.featured_order }),
              ...(data.rating !== undefined && { rating: data.rating }),
              ...(data.image_url_2 && { image_url_2: data.image_url_2 }),
              ...(data.image_url_3 && { image_url_3: data.image_url_3 }),
              ...(data.image_url_4 && { image_url_4: data.image_url_4 }),
              ...(data.image_url_5 && { image_url_5: data.image_url_5 }),
            };

            // Debug log untuk memverifikasi data yang dikirim
            if (index < 2) { // Log hanya untuk 2 produk pertama
              console.log(`[DEBUG] Row ${index + 2} - Clean data for Supabase:`, {
                commission: cleanData.commission,
                commission_type: typeof cleanData.commission,
                item: cleanData.item,
                video_url: cleanData.video_url?.substring(0, 50),
                product_name: cleanData.product_name?.substring(0, 30)
              });
            }

            successfulImports++;
            try {
              const result = await addProduct.mutateAsync(cleanData);
              console.log(`[DEBUG] Row ${index + 2} - Insert result:`, result);
              return { success: true };
            } catch (insertError: any) {
              console.error(`[DEBUG] Row ${index + 2} - Insert failed:`, {
                error: insertError,
                message: insertError?.message,
                details: insertError?.details,
                hint: insertError?.hint,
                code: insertError?.code
              });

              // Check if it's an RLS policy error
              if (insertError?.message?.includes('policy') || insertError?.code === '42501') {
                console.error(`[DEBUG] Row ${index + 2} - RLS Policy Error: User may not have admin role in profiles table`);
              }

              throw insertError; // Re-throw to be caught by Promise.allSettled
            }
          } else {
            failedImports++;
            // Log detailed error for the user
            const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            toast({
              variant: "destructive",
              title: `Validation Error on Row ${index + 2}`,
              description: `Skipping row. Details: ${errorMessages}`,
            });
            return Promise.resolve(); // Resolve to not break Promise.allSettled
          }
        });

        Promise.allSettled(importPromises)
          .then((results) => {
            const additionalFailures = results.filter(result => result.status === 'rejected').length;
            failedImports += additionalFailures;

            if (additionalFailures > 0) {
              console.error('Import failures:', results.filter(result => result.status === 'rejected'));
            }

            toast({
              title: "Import Complete",
              description: `${successfulImports} products imported successfully. ${failedImports} rows failed.`,
              variant: failedImports > 0 ? "destructive" : "default"
            });
          })
          .catch((error) => {
            toast({ variant: "destructive", title: "Import Error", description: `An unexpected error occurred during import: ${error.message}` });
          });
      },
      error: (error) => {
        toast({ variant: "destructive", title: "Error", description: `CSV parsing failed: ${error.message}` });
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Product Management</span>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Product ID..."
                  className="pl-8 sm:w-[250px]"
                  value={searchById}
                  onChange={(e) => setSearchById(e.target.value)}
                />
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Product Name..."
                  className="pl-8 sm:w-[250px]"
                  value={searchByName}
                  onChange={(e) => setSearchByName(e.target.value)}
                />
              </div>

              {selectedProductIds.length > 0 ? (
                <>
                  <Button variant="destructive" onClick={handleBulkDeleteClick}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedProductIds.length}) Selected
                  </Button>
                  <Button onClick={handleBulkGenerateRating}>
                    <Star className="h-4 w-4 mr-2" />
                    Generate Rating ({selectedProductIds.length}) Selected
                  </Button>
                  <Button onClick={handleBulkUpdateClick}>
                    <Edit className="h-4 w-4 mr-2" />
                    Bulk Update ({selectedProductIds.length}) Selected
                  </Button>
                </>
              ) : (
                <Button onClick={handleAddClick}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
              )}
              <Button variant="outline" onClick={handleImport}><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
              <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <p>Loading products...</p>
          ) : (
            <>
              <ProductDataTable
                products={filteredProducts}
                selectedProductIds={selectedProductIds}
                onSelectionChange={setSelectedProductIds}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
                onGenerateRating={handleGenerateRating}
              />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, allProducts.length)} of {allProducts.length} products
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              Fill in the details below. Click submit when you're done.
            </DialogDescription>
          </DialogHeader>
          <ProductForm 
            product={selectedProduct}
            onSubmit={handleFormSubmit} 
            isSubmitting={addProduct.isPending || updateProduct.isPending} 
          />
        </DialogContent>
      </Dialog>

      <BulkUpdateDialog 
        isOpen={isBulkUpdateDialogOpen} 
        onOpenChange={setIsBulkUpdateDialogOpen} 
        onSubmit={handleBulkUpdateSubmit} 
      />

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete 
              {selectedProductIds.length > 0 
                ? `${selectedProductIds.length} product(s)` 
                : <span className="font-bold">{selectedProduct?.product_name}</span>}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteProduct.isPending}>
              {deleteProduct.isPending ? "Deleting..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CSVLink
        data={csvExportData}
        filename={"products-export.csv"}
        ref={csvLinkRef}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileChange}
      />
    </>
  );
}