"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "./FilterPanel";
import type { ProductFilters } from "@root/lib/productFilters";

interface LocationOption {
  value: string;
  count: number;
}

interface FilterSheetProps {
  filters: ProductFilters;
  /** The route's base filters -- what "Reset" restores the draft to. */
  base: ProductFilters;
  onApply: (next: ProductFilters) => void;
  category?: string;
  subcategory?: string;
  /** Extra badge count shown on the trigger (from live filters). */
  activeCount: number;
  locationOptions: LocationOption[];
  isLoadingLocation: boolean;
}

// The mobile filter UI -- a bottom sheet editing a local DRAFT that is only
// committed (pushing the URL + refetching) when "Terapkan" is pressed. This
// removes the old 500ms debounce and the stray fetch on every typed digit.
export function FilterSheet({
  filters,
  base,
  onApply,
  category,
  subcategory,
  activeCount,
  locationOptions,
  isLoadingLocation,
}: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductFilters>(filters);

  // Snapshot the live filters into the draft each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDraftChange = (part: Partial<ProductFilters>) => {
    setDraft((prev) => ({ ...prev, ...part }));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 relative"
          aria-label="Filter"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald text-emerald-foreground text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Filter Produk</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          <FilterPanel
            filters={draft}
            onChange={handleDraftChange}
            category={category}
            subcategory={subcategory}
            locationOptions={locationOptions}
            isLoadingLocation={isLoadingLocation}
          />
        </div>

        <SheetFooter className="mt-4 pt-3 border-t border-border sticky bottom-0 bg-background">
          <Button
            variant="ghost"
            onClick={() => setDraft(base)}
            className="flex items-center gap-1 text-emerald"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            className="bg-emerald text-emerald-foreground hover:bg-emerald/90"
          >
            Terapkan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
