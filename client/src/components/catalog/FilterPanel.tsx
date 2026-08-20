"use client";

import { useState } from "react";
import { Tag, Star, MapPin, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useItemOptionsByCategory } from "@/hooks/useProductQueries";
import { PRICE_PRESETS, RATING_OPTIONS } from "@root/lib/productFilters";
import type { ProductFilters } from "@root/lib/productFilters";

interface LocationOption {
  value: string;
  count: number;
}

interface FilterPanelProps {
  filters: ProductFilters;
  /** Called with a partial update (apply-langsung on desktop, draft on mobile). */
  onChange: (part: Partial<ProductFilters>) => void;
  category?: string;
  subcategory?: string;
  locationOptions: LocationOption[];
  isLoadingLocation: boolean;
}

const LOCATION_VISIBLE = 8;

// The actual filter content, shared by the mobile bottom sheet (which edits a
// local draft and applies on "Terapkan") and the desktop sidebar (apply-langsung).
export function FilterPanel({
  filters,
  onChange,
  category,
  subcategory,
  locationOptions,
  isLoadingLocation,
}: FilterPanelProps) {
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");

  const { data: itemOptions, isLoading: isLoadingItems } = useItemOptionsByCategory(
    subcategory ? category : undefined,
    subcategory
  );

  const pricePresetActive = (min: number, max: number) =>
    filters.priceMin === min && filters.priceMax === max;

  const visibleLocations = showAllLocations
    ? locationOptions.filter((o) => o.value.toLowerCase().includes(locationSearch.toLowerCase()))
    : locationOptions.slice(0, LOCATION_VISIBLE);

  return (
    <div className="space-y-8">
      {/* Price -- presets + manual min/max (the old 0-20jt slider put ~97% of
          products in the first 4 steps; presets match the real distribution). */}
      <section>
        <h4 className="font-semibold mb-3 flex items-center">
          <Tag className="h-4 w-4 text-emerald mr-2" /> Rentang Harga
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={pricePresetActive(preset.min, preset.max)}
              onClick={() => onChange({ priceMin: preset.min, priceMax: preset.max })}
              className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs text-left leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                pricePresetActive(preset.min, preset.max)
                  ? "border-emerald bg-emerald/10 text-emerald font-semibold"
                  : "border-border hover:border-emerald/50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Min (Rp)</label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.priceMin === 0 ? "" : filters.priceMin}
              onChange={(e) => onChange({ priceMin: e.target.value ? Number(e.target.value) : 0 })}
              placeholder="0"
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max (Rp)</label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.priceMax === 20_000_000 ? "" : filters.priceMax}
              onChange={(e) =>
                onChange({ priceMax: e.target.value ? Number(e.target.value) : 20_000_000 })
              }
              placeholder="20000000"
              className="w-full text-sm"
            />
          </div>
        </div>
      </section>

      {/* Rating -- only 4.5+ / 4.8+ / 5.0 make sense given the distribution. */}
      <section>
        <h4 className="font-semibold mb-3 flex items-center">
          <Star className="h-4 w-4 text-yellow mr-2" /> Rating
        </h4>
        <div className="space-y-2">
          {RATING_OPTIONS.map((rating) => {
            const active = filters.ratingMin === rating;
            return (
              <button
                key={rating}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ratingMin: active ? undefined : rating })}
                className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-emerald bg-emerald/10 text-emerald font-semibold"
                    : "border-border hover:border-emerald/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-3.5 w-3.5 ${
                        s <= Math.round(rating) ? "text-yellow fill-yellow" : "text-muted-foreground/40"
                      }`}
                    />
                  ))}
                  <span className="ml-1">{rating.toLocaleString("id-ID")} ke atas</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Location ("Lokasi" = the shop's origin) -- top 8 by count + search. */}
      <section>
        <h4 className="font-semibold mb-3 flex items-center">
          <MapPin className="h-4 w-4 text-metallic mr-2" /> Lokasi
        </h4>
        {isLoadingLocation ? (
          <p className="text-sm text-muted-foreground">Memuat lokasi...</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {visibleLocations.map((option) => {
                const active = filters.dikirim_dari === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ dikirim_dari: active ? undefined : option.value })}
                    className={`min-h-[44px] px-3 py-1.5 rounded-full border text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-emerald bg-emerald text-emerald-foreground font-semibold"
                        : "border-border hover:border-emerald/50"
                    }`}
                  >
                    {option.value}
                    <span className={`ml-1 ${active ? "text-emerald-foreground/80" : "text-muted-foreground"}`}>
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {showAllLocations && (
              <Input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Cari lokasi..."
                className="w-full text-sm mb-2"
              />
            )}

            {locationOptions.length > LOCATION_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowAllLocations((v) => !v)}
                className="text-sm text-emerald font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring outline-none"
              >
                {showAllLocations ? "Sembunyikan" : `Lihat semua (${locationOptions.length})`}
              </button>
            )}
          </>
        )}
      </section>

      {/* Item -- only when a subcategory is active and options exist. */}
      {subcategory && (
        <section>
          <h4 className="font-semibold mb-3 flex items-center">
            <Package className="h-4 w-4 text-violet mr-2" /> Item
          </h4>
          {isLoadingItems ? (
            <p className="text-sm text-muted-foreground">Memuat item...</p>
          ) : itemOptions && itemOptions.length > 0 ? (
            <div className="space-y-1">
              {itemOptions.map(({ value }) => {
                const active = filters.item === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ item: active ? undefined : value })}
                    className={`w-full min-h-[44px] text-left px-3 py-2 rounded-lg border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-emerald bg-emerald/10 text-emerald font-semibold"
                        : "border-border hover:border-emerald/50"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada item tersedia</p>
          )}
        </section>
      )}
    </div>
  );
}
