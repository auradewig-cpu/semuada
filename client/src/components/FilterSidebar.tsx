
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tag, Folder, Loader2, RotateCcw, SlidersHorizontal, Truck, ArrowUpDown } from 'lucide-react';
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
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  // The destination URL of an in-flight category/subcategory click. Rendering
  // from this instead of waiting for useParams() to catch up is what makes the
  // checkbox tick on the same frame as the click -- before this, `checked` was
  // derived purely from the URL, so a click produced NO visible feedback at all
  // until the navigation had committed.
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const [categorySlug, subcategorySlug] = useMemo(() => {
    if (pendingPath === null) return [params.category, params.subcategory] as const;
    const [category, subcategory] = pendingPath.split('/').filter(Boolean);
    return [category, subcategory] as const;
  }, [pendingPath, params.category, params.subcategory]);

  // Drop the optimistic slug once the real URL it was predicting has landed.
  useEffect(() => {
    setPendingPath(null);
  }, [params.category, params.subcategory]);

  const navigate = useCallback(
    (path: string) => {
      setPendingPath(path);
      // A transition keeps the CURRENT products on screen while the next route
      // streams in, instead of tearing them down for a skeleton.
      startTransition(() => {
        router.push(path, { scroll: false });
      });
    },
    [router]
  );

  const activeCategoryName = categorySlug ? categorySlugMap.get(categorySlug) : undefined;
  const activeSubcategoryName = subcategorySlug ? subcategorySlugMap.get(subcategorySlug) : undefined;
  // Item options are only ever RENDERED under an expanded subcategory, but this
  // used to fire whenever a category was set too -- one wasted request on every
  // category page view, for data nothing displayed.
  const { data: activeSubcategoryItems, isLoading: isLoadingActiveSubcategoryItems } = useItemOptionsByCategory(
    activeSubcategoryName ? activeCategoryName : undefined,
    activeSubcategoryName
  );

  const [localPriceMin, setLocalPriceMin] = useState(filters.priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(filters.priceMax);

  useEffect(() => {
    setLocalPriceMin(filters.priceMin);
    setLocalPriceMax(filters.priceMax);
  }, [filters.priceMin, filters.priceMax]);

  // Read the live filters through a ref rather than depending on them: with
  // `filters` in the dep array this effect re-ran on EVERY render, tearing down
  // and recreating the 500ms timer each time.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const current = filtersRef.current;
    if (localPriceMin === current.priceMin && localPriceMax === current.priceMax) return;

    const timeout = setTimeout(() => {
      onFiltersChange({
        ...filtersRef.current,
        priceMin: localPriceMin,
        priceMax: localPriceMax,
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [localPriceMin, localPriceMax, onFiltersChange]);

  // NOTE: there is deliberately no URL -> filters effect here anymore. Home.tsx
  // owns `filters` and already syncs them from the route (see its effect on
  // categorySlug/subcategorySlug). Having both do it meant that clicking a
  // category set filters.category optimistically, this effect immediately saw
  // useParams() still pointing at the OLD url and reset it back, and the
  // navigation then set it a third time -- two discarded /api/products fetches
  // and a skeleton flash per click.

  const resetFilters = () => {
    if (params.category || params.subcategory) {
      // Leaving a category route remounts Home with server-rendered defaults,
      // which resets every filter anyway -- changing them here first would only
      // buy an extra discarded fetch.
      navigate('/');
      return;
    }
    setLocalPriceMin(0);
    setLocalPriceMax(20000000);
    onFiltersChange({
      search: '',
      priceMin: 0,
      priceMax: 20000000,
      sortBy: 'newest',
      category: undefined,
      subcategory: undefined,
      dikirim_dari: undefined,
      item: undefined,
    });
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

    // Category/subcategory live in the URL, so a click only navigates -- it no
    // longer touches `filters`. Home.tsx re-derives them from the route, and
    // the destination page arrives with its products already server-rendered,
    // so setting them here would just fire a fetch that gets thrown away.
    const handleCategoryClick = (categoryName: string) => {
      navigate(categoryName === activeCategoryName ? '/' : `/${slugify(categoryName)}`);
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
            const categoryPath = `/${currentCategorySlug}`;

            return (
              <div key={categoryName}>
                <div
                  className="flex items-center space-x-3"
                  // Warm the route before the click lands. On touch devices
                  // pointerenter still fires just ahead of the tap.
                  onPointerEnter={() => router.prefetch(categoryPath)}
                  onFocus={() => router.prefetch(categoryPath)}
                >
                  <Checkbox
                    id={categoryName}
                    checked={isCategoryOpen}
                    onCheckedChange={() => handleCategoryClick(categoryName)}
                    className="rounded-full data-[state=checked]:bg-emerald data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={categoryName}
                    className="cursor-pointer hover:text-emerald transition-colors w-full flex items-center gap-2"
                  >
                    {categoryName}
                    {isPending && isCategoryOpen && !subcategorySlug && (
                      <Loader2 className="h-3 w-3 animate-spin text-emerald" aria-hidden="true" />
                    )}
                  </Label>
                </div>
                {isCategoryOpen && subcategories.length > 0 && (() => {
                  const handleSubcategoryClick = (clickedSubcategorySlug: string) => {
                    navigate(
                      clickedSubcategorySlug === subcategorySlug
                        ? categoryPath
                        : `${categoryPath}/${clickedSubcategorySlug}`
                    );
                  };

                  return (
                    <ul className="space-y-2 pl-8 pt-2">
                      {subcategories.map(subcategoryName => {
                        const currentSubcategorySlug = slugify(subcategoryName);
                        const isSubcategoryActive = subcategorySlug === currentSubcategorySlug;
                        const subcategoryPath = `${categoryPath}/${currentSubcategorySlug}`;
                        return (
                          <li key={subcategoryName} className="space-y-2">
                            <div
                              className="flex items-center space-x-3"
                              onPointerEnter={() => router.prefetch(subcategoryPath)}
                              onFocus={() => router.prefetch(subcategoryPath)}
                            >
                              <Checkbox
                                id={`subcategory-${currentSubcategorySlug}`}
                                checked={isSubcategoryActive}
                                onCheckedChange={() => handleSubcategoryClick(currentSubcategorySlug)}
                                className="rounded-full data-[state=checked]:bg-emerald data-[state=checked]:text-white"
                              />
                              <Label
                                htmlFor={`subcategory-${currentSubcategorySlug}`}
                                className={`cursor-pointer hover:text-emerald transition-colors text-sm flex items-center gap-2 ${isSubcategoryActive ? 'text-emerald font-bold' : 'text-muted-foreground'}`}
                              >
                                {subcategoryName}
                                {isPending && isSubcategoryActive && (
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald" aria-hidden="true" />
                                )}
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
        <div className="bg-card rounded-xl border border-border p-6 sticky top-24 shadow-xl ring-1 ring-black/5 transition-all" aria-busy={isPending}>
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
              <Truck className="w-4 h-4 text-emerald mr-2" />
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
              <ArrowUpDown className="w-4 h-4 text-emerald mr-2" />
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
