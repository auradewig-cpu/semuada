"use client";

import { X } from "lucide-react";
import { PRICE_MAX, PRICE_PRESETS } from "@root/lib/productFilters";
import type { ProductFilters } from "@root/lib/productFilters";
import { formatPrice } from "@/lib/utils";

interface ActiveFilterChipsProps {
  filters: ProductFilters;
  /** Remove one filter (partial update). */
  onRemove: (part: Partial<ProductFilters>) => void;
  onClearAll: () => void;
}

// Chips for each active filter, each with a ✕, plus "Hapus semua".
export function ActiveFilterChips({ filters, onRemove, onClearAll }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; remove: () => void }[] = [];

  const activePreset = PRICE_PRESETS.find(
    (p) => p.min === filters.priceMin && p.max === filters.priceMax
  );

  if (activePreset) {
    // A whole preset is active -- remove both bounds together.
    chips.push({
      key: "price-preset",
      label: activePreset.label,
      remove: () => onRemove({ priceMin: 0, priceMax: PRICE_MAX }),
    });
  } else {
    // Custom bounds: min and max are independent, so each gets its own chip.
    // (These used to be chained with `else if`, which silently hid the max chip
    // whenever a min was also set.)
    if (filters.priceMin !== undefined && filters.priceMin !== 0) {
      chips.push({
        key: "price-min",
        label: `Min ${formatPrice(filters.priceMin)}`,
        remove: () => onRemove({ priceMin: 0 }),
      });
    }
    if (filters.priceMax !== undefined && filters.priceMax !== PRICE_MAX) {
      chips.push({
        key: "price-max",
        label: `Maks ${formatPrice(filters.priceMax)}`,
        remove: () => onRemove({ priceMax: PRICE_MAX }),
      });
    }
  }

  if (filters.ratingMin !== undefined) {
    chips.push({
      key: "rating",
      label: `Bintang ${filters.ratingMin.toLocaleString("id-ID")}+`,
      remove: () => onRemove({ ratingMin: undefined }),
    });
  }

  if (filters.dikirim_dari) {
    chips.push({
      key: "lokasi",
      label: filters.dikirim_dari,
      remove: () => onRemove({ dikirim_dari: undefined }),
    });
  }

  if (filters.item) {
    chips.push({
      key: "item",
      label: filters.item,
      remove: () => onRemove({ item: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="container mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 shrink-0">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 whitespace-nowrap min-h-[36px] px-3 py-1 rounded-full bg-emerald/10 text-emerald text-sm border border-emerald/30"
          >
            {chip.label}
            <button
              type="button"
              aria-label={`Hapus filter ${chip.label}`}
              onClick={chip.remove}
              className="p-0.5 rounded-full hover:bg-emerald/20 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-[36px] shrink-0 text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Hapus semua
        </button>
      )}
    </div>
  );
}
