"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CategorySubcategory } from "@root/lib/categories";

interface SubcategoryChipsProps {
  subcategories: CategorySubcategory[];
  categorySlug: string;
}

// Horizontal, snap-scrolling row of subcategory chips below the header. The
// first ("Semua") links back to the bare category route. Uses the same
// optimistic pendingPath pattern as the old FilterSidebar so a chip lights up
// the instant it's tapped, before navigation commits.
//
// Real <Link>s, not buttons: these are the only in-page links to the ~93
// subcategory routes, so buttons would hide them from crawlers and from
// "open in new tab", and lose the hover/focus prefetch warm-up.
export function SubcategoryChips({ subcategories, categorySlug }: SubcategoryChipsProps) {
  const params = useParams<{ subcategory?: string }>();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const [activeSlug, categoryPath] = useMemo(() => {
    if (pendingPath === null) return [params.subcategory, `/${categorySlug}`] as const;
    const parts = pendingPath.split("/").filter(Boolean);
    const sub = parts[1] ?? undefined;
    return [sub, `/${parts[0]}`] as const;
  }, [pendingPath, params.subcategory, categorySlug]);

  useEffect(() => {
    setPendingPath(null);
  }, [params.subcategory]);

  const chips: { label: string; slug?: string; path: string }[] = [
    { label: "Semua", path: `/${categorySlug}` },
    ...subcategories.map((s) => ({
      label: s.name,
      slug: s.slug,
      path: `/${categorySlug}/${s.slug}`,
    })),
  ];

  return (
    <nav
      aria-label="Subkategori"
      className="overflow-x-auto scrollbar-none snap-x scroll-px-4"
    >
      <div className="flex gap-2 px-4 py-3 w-max">
        {chips.map((chip) => {
          const isActive = activeSlug === chip.slug;
          return (
            <Link
              key={chip.path}
              href={chip.path}
              scroll={false}
              onClick={() => setPendingPath(chip.path)}
              onPointerEnter={() => router.prefetch(chip.path)}
              onFocus={() => router.prefetch(chip.path)}
              aria-current={isActive ? "page" : undefined}
              className={`snap-start min-h-[40px] flex items-center whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-emerald text-emerald-foreground"
                  : "bg-card border border-border text-foreground hover:border-emerald/50"
              }`}
            >
              {chip.label}
              {pendingPath === chip.path && (
                <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
