
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tag, Folder, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCategoryContext } from '@/context/CategoryContext';
import { useSettings } from '@/hooks/useSettings';
import { usePengirimanOptions, useItemOptions, useItemOptionsByCategory } from '@/hooks/useProductQueries';
import { formatPrice, slugify } from '@/lib/utils';
import type { FilterState } from '@/types';

interface FilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: Omit<FilterState, 'categories'>) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export function FilterSidebar({ filters, onFiltersChange, showFilters, onToggleFilters }: FilterSidebarProps) {
  const { hierarchy, isLoading: isHierarchyLoading, categorySlugMap, subcategorySlugMap } = useCategoryContext();
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const { data: pengirimanOptions, isLoading: isLoadingPengiriman } = usePengirimanOptions();
  const params = useParams<{ category?: string; subcategory?: string }>();
  const categorySlug = params.category;
  const subcategorySlug = params.subcategory;
  const router = useRouter();
  const navigate = (path: string) => router.push(path, { scroll: false });

  // Get item options for the currently active subcategory
  const activeCategoryName = categorySlug ? categorySlugMap.get(categorySlug) : undefined;
  const activeSubcategoryName = subcategorySlug ? subcategorySlugMap.get(subcategorySlug) : undefined;
  const { data: activeSubcategoryItems, isLoading: isLoadingActiveSubcategoryItems } = useItemOptionsByCategory(activeCategoryName, activeSubcategoryName);

  const [localPriceMin, setLocalPriceMin] = useState(filters.priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(filters.priceMax);

  useEffect(() => {
    setLocalPriceMin(filters.priceMin);
    setLocalPriceMax(filters.priceMax);
  }, [filters.priceMin, filters.priceMax]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localPriceMin !== filters.priceMin || localPriceMax !== filters.priceMax) {
        onFiltersChange({
          ...filters,
          priceMin: localPriceMin,
          priceMax: localPriceMax
        });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [localPriceMin, localPriceMax, filters, onFiltersChange]);

  // Update filters when URL params change
  useEffect(() => {
    const categoryName = categorySlug ? categorySlugMap.get(categorySlug) : undefined;
    const subcategoryName = subcategorySlug ? subcategorySlugMap.get(subcategorySlug) : undefined;

    // Only update if the values are different from current filters
    if (categoryName !== filters.category || subcategoryName !== filters.subcategory) {
      onFiltersChange({
        ...filters,
        category: categoryName,
        subcategory: subcategoryName,
        // Reset item filter when category/subcategory changes
        item: categoryName !== filters.category || subcategoryName !== filters.subcategory ? undefined : filters.item,
      });
    }
  }, [categorySlug, subcategorySlug, categorySlugMap, subcategorySlugMap, filters, onFiltersChange]);

  const resetFilters = () => {
    const resetState = {
      search: '',
      priceMin: 0,
      priceMax: 20000000,
      sortBy: 'newest',
      category: undefined,
      subcategory: undefined,
      dikirim_dari: undefined,
      item: undefined,
    };
    setLocalPriceMin(0);
    setLocalPriceMax(20000000);
    onFiltersChange(resetState);
    navigate('/');
  };

  const handlePriceSliderChange = (values: number[]) => {
    setLocalPriceMin(values[0]);
    setLocalPriceMax(values[1]);
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sortBy
    });
  };

  const handlePengirimanChange = (dikirim_dari: string) => {
    onFiltersChange({
      ...filters,
      dikirim_dari: dikirim_dari === "all" ? undefined : dikirim_dari
    });
  };

  const handleItemChange = (item: string) => {
    onFiltersChange({
      ...filters,
      item: item === "all" ? undefined : item
    });
  };

  const renderCategoryFilter = () => {
    if (isLoadingSettings || isHierarchyLoading) {
      return <p>Loading categories...</p>;
    }

    if (!settings?.show_category_filter) {
      return null;
    }

    const activeCategoryName = categorySlug ? categorySlugMap.get(categorySlug) : undefined;

    const handleCategoryClick = (categoryName: string) => {
      if (categoryName === activeCategoryName) {
        // Toggle off: reset category and subcategory filters
        onFiltersChange({
          ...filters,
          category: undefined,
          subcategory: undefined,
          item: undefined, // Also reset item filter
        });
        navigate('/'); // Toggle off if clicking the active category
      } else {
        // Toggle on: set category filter
        onFiltersChange({
          ...filters,
          category: categoryName,
          subcategory: undefined, // Reset subcategory when changing category
          item: undefined, // Reset item when changing category
        });
        navigate(`/${slugify(categoryName)}`);
      }
    };

    return (
      <div className="mb-8">
        <h4 className="font-semibold mb-4 flex items-center">
          <Folder className="h-4 w-4 text-emerald mr-2" />
          Kategori
        </h4>
        <div className="space-y-3">
          {Array.from(hierarchy.keys()).sort().map(categoryName => {
            const subcategories = Array.from(hierarchy.get(categoryName) || []).sort();
            const currentCategorySlug = slugify(categoryName);
            const isCategoryOpen = activeCategoryName === categoryName;

            return (
              <div key={categoryName}>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id={categoryName} 
                    checked={isCategoryOpen}
                    onCheckedChange={() => handleCategoryClick(categoryName)}
                    className="rounded-full data-[state=checked]:bg-emerald data-[state=checked]:text-white"
                  />
                  <Label 
                    htmlFor={categoryName} 
                    className="cursor-pointer hover:text-emerald transition-colors w-full"
                  >
                    {categoryName}
                  </Label>
                </div>
                {isCategoryOpen && subcategories.length > 0 && (() => {
                  const handleSubcategoryClick = (clickedSubcategorySlug: string) => {
                    if (clickedSubcategorySlug === subcategorySlug) {
                      // Toggle off: navigate to parent category and reset subcategory filter
                      onFiltersChange({
                        ...filters,
                        subcategory: undefined,
                        item: undefined, // Also reset item filter
                      });
                      navigate(`/${currentCategorySlug}`);
                    } else {
                      // Toggle on: navigate to subcategory and set subcategory filter
                      const subcategoryName = subcategories.find(sub =>
                        slugify(sub) === clickedSubcategorySlug
                      );
                      onFiltersChange({
                        ...filters,
                        subcategory: subcategoryName,
                        item: undefined, // Reset item when changing subcategory
                      });
                      navigate(`/${currentCategorySlug}/${clickedSubcategorySlug}`);
                    }
                  };

                  return (
                    <ul className="space-y-2 pl-8 pt-2">
                      {subcategories.map(subcategoryName => {
                        const currentSubcategorySlug = slugify(subcategoryName);
                        const isSubcategoryActive = subcategorySlug === currentSubcategorySlug;
                        return (
                          <li key={subcategoryName} className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`subcategory-${currentSubcategorySlug}`}
                                checked={isSubcategoryActive}
                                onCheckedChange={() => handleSubcategoryClick(currentSubcategorySlug)}
                                className="rounded-full data-[state=checked]:bg-emerald data-[state=checked]:text-white"
                              />
                              <Label
                                htmlFor={`subcategory-${currentSubcategorySlug}`}
                                className={`cursor-pointer hover:text-emerald transition-colors text-sm ${isSubcategoryActive ? 'text-emerald font-bold' : 'text-muted-foreground'}`}
                              >
                                {subcategoryName}
                              </Label>
                            </div>
                            {isSubcategoryActive && (
                              <div className="pl-4 pt-2 space-y-1">
                                {isLoadingActiveSubcategoryItems ? (
                                  <p className="text-xs text-muted-foreground">Loading items...</p>
                                ) : activeSubcategoryItems && activeSubcategoryItems.length > 0 ? (
                                  activeSubcategoryItems.map((item) => {
                                    const isItemActive = filters.item === item;
                                    return (
                                      <div key={item} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`item-${item}`}
                                          checked={isItemActive}
                                          onCheckedChange={() => {
                                            if (isItemActive) {
                                              // Toggle off: reset item filter
                                              onFiltersChange({
                                                ...filters,
                                                item: undefined,
                                              });
                                            } else {
                                              // Toggle on: set item filter
                                              onFiltersChange({
                                                ...filters,
                                                item: item,
                                              });
                                            }
                                          }}
                                          className="rounded-full data-[state=checked]:bg-emerald data-[state=checked]:text-white"
                                        />
                                        <Label
                                          htmlFor={`item-${item}`}
                                          className={`cursor-pointer hover:text-emerald transition-colors text-xs ${
                                            isItemActive ? 'text-emerald font-semibold' : 'text-muted-foreground'
                                          }`}
                                        >
                                          {item}
                                        </Label>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-muted-foreground">Tidak ada item tersedia</p>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-6">
        <Button
          onClick={onToggleFilters}
          variant="outline"
          className="flex items-center space-x-2 w-full justify-center"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filter & Sort</span>
        </Button>
      </div>

      <div className={`lg:block ${showFilters ? 'block' : 'hidden'}`}>
        <div className="bg-card rounded-xl border border-border p-6 sticky top-24 shadow-xl ring-1 ring-black/5 transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Filter Produk</h3>
            <Button
              onClick={resetFilters}
              variant="ghost"
              size="sm"
              className="text-emerald hover:text-emerald/80 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
          
          {/* Price Range Filter */}
          <div className="mb-8">
            <h4 className="font-semibold mb-4 flex items-center">
              <Tag className="h-4 w-4 text-emerald mr-2" />
              Rentang Harga
            </h4>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-xs text-muted-foreground">Minimum</label>
                <Input
                  type="number"
                  value={localPriceMin}
                  onChange={(e) => setLocalPriceMin(Number(e.target.value))}
                  placeholder="0"
                  className="w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Maksimum</label>
                <Input
                  type="number"
                  value={localPriceMax}
                  onChange={(e) => setLocalPriceMax(Number(e.target.value))}
                  placeholder="20000000"
                  className="w-full text-sm"
                />
              </div>
            </div>
            <div className="px-2 mb-4">
              <Slider
                value={[localPriceMin, localPriceMax]}
                onValueChange={handlePriceSliderChange}
                max={20000000}
                min={0}
                step={100000}
                className="w-full"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {formatPrice(localPriceMin)} - {formatPrice(localPriceMax)}
            </div>
          </div>
          
          {/* Category Filter */}
          {renderCategoryFilter()}

          {/* Pengiriman Filter */}
          <div className="mb-8">
            <h4 className="font-semibold mb-4 flex items-center">
              <i className="fas fa-truck text-emerald mr-2"></i>
              Pilih Pengiriman
            </h4>
            {isLoadingPengiriman ? (
              <p>Loading pengiriman options...</p>
            ) : (
              <Select
                value={filters.dikirim_dari || "all"}
                onValueChange={handlePengirimanChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua pengiriman" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pengiriman</SelectItem>
                  {pengirimanOptions?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>


          {/* Sort Options */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center">
              <i className="fas fa-sort text-emerald mr-2"></i>
              Urutkan
            </h4>
            <Select value={filters.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih urutan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="popular">Populer</SelectItem>
                <SelectItem value="terlaris">Terlaris</SelectItem>
                <SelectItem value="harga_termurah">Harga Termurah</SelectItem>
                <SelectItem value="harga_tertinggi">Harga Tertinggi</SelectItem>
                <SelectItem value="rekomendasi">Rekomendasi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}
