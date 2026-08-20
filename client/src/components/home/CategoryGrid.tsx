"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getCategoryIcon, TINT_CLASSES } from "@/lib/categoryIcons";
import type { CategoryEntry } from "@root/lib/categories";

interface CategoryGridProps {
  entries: CategoryEntry[];
}

const MOBILE_VISIBLE = 8;

// The homepage's category grid -- a marketplace-style grid of tappable,
// icon-tinted category tiles, ordered by product count (server-provided, so it
// ships in the first HTML with zero client requests). Mobile shows the 8 most
// popular plus a "Semua Kategori" expand toggle; desktop shows every tile.
export function CategoryGrid({ entries }: CategoryGridProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-label="Kategori" className="bg-card border border-border rounded-2xl">
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-1 p-2">
        {/* Every tile is rendered; the overflow is hidden with CSS on small
            screens only. Slicing the array instead meant desktop -- where the
            expand toggle is hidden -- could never reach categories 9..18. */}
        {entries.map((entry, index) => {
          const { Icon, tint } = getCategoryIcon(entry.name, index);
          const hiddenOnMobile = !expanded && index >= MOBILE_VISIBLE;
          return (
            <Link
              key={entry.slug}
              href={`/${entry.slug}`}
              onPointerEnter={() => router.prefetch(`/${entry.slug}`)}
              onFocus={() => router.prefetch(`/${entry.slug}`)}
              className={`${
                hiddenOnMobile ? "hidden lg:flex" : "flex"
              } flex-col items-center gap-1.5 rounded-xl px-1 py-3 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors min-h-[80px]`}
              aria-label={`${entry.name}, ${entry.productCount} produk`}
            >
              <span
                className={`h-12 w-12 rounded-full flex items-center justify-center ${TINT_CLASSES[tint]}`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-[11px] leading-tight text-center line-clamp-2 text-foreground">
                {entry.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {entry.productCount.toLocaleString("id-ID")} produk
              </span>
            </Link>
          );
        })}
      </div>

      {/* Expand toggle -- mobile only (desktop always shows all). */}
      <div className="lg:hidden border-t border-border p-2">
        {entries.length > MOBILE_VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="w-full flex items-center justify-center gap-1 py-2 min-h-[44px] text-sm font-medium text-emerald rounded-lg hover:bg-emerald/10 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors"
          >
            {expanded ? (
              <>
                Tampilkan Lebih Sedikit <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Semua Kategori <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
