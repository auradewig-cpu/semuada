"use client";

import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortKey } from "@root/lib/productFilters";

interface SortBarProps {
  sortBy: SortKey;
  onSortChange: (sortBy: SortKey) => void;
  /** The FilterSheet (renders the Filter trigger button). */
  filterTrigger: ReactNode;
}

const TABS: { key: SortKey; label: string }[] = [
  { key: "rekomendasi", label: "Terkait" },
  { key: "newest", label: "Terbaru" },
  { key: "terlaris", label: "Terlaris" },
];

// Shopee-style sticky toolbar: relevance/newest/bestselling tabs, a price
// toggle, and the Filter button. Sticky at the top (below the header) -- the
// bottom-right corner is already taken by the WhatsApp FAB.
export function SortBar({ sortBy, onSortChange, filterTrigger }: SortBarProps) {
  const isPrice = sortBy === "harga_termurah" || sortBy === "harga_tertinggi";

  const handlePrice = () => {
    onSortChange(sortBy === "harga_tertinggi" ? "harga_termurah" : "harga_tertinggi");
  };

  const tabClass = (active: boolean) =>
    `min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "text-emerald" : "text-muted-foreground hover:text-foreground"
    }`;

  // Sticks by the header's MEASURED height (--header-h, published by
  // SiteHeader) -- a hardcoded offset put this bar underneath the header, which
  // is ~136px tall on mobile and sits above it at z-50.
  return (
    <div className="sticky top-[var(--header-h)] z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={sortBy === tab.key}
              onClick={() => onSortChange(tab.key)}
              className={tabClass(sortBy === tab.key)}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            aria-pressed={isPrice}
            onClick={handlePrice}
            className={tabClass(isPrice)}
          >
            Harga
            {sortBy === "harga_termurah" && <ArrowUp className="inline h-3.5 w-3.5 ml-0.5" aria-hidden="true" />}
            {sortBy === "harga_tertinggi" && <ArrowDown className="inline h-3.5 w-3.5 ml-0.5" aria-hidden="true" />}
            {!isPrice && <ArrowUpDown className="inline h-3.5 w-3.5 ml-0.5 opacity-60" aria-hidden="true" />}
          </button>
        </div>

        <div className="ml-auto shrink-0">{filterTrigger}</div>
      </div>
    </div>
  );
}
