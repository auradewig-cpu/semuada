"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ProductFilters } from "@root/lib/productFilters";
import { parseFiltersFromQuery, filtersToQuery, countActiveFilters } from "@root/lib/productFilters";

export interface CatalogFiltersApi {
  filters: ProductFilters;
  /** Full replace: set state + push URL. */
  setFilters(next: ProductFilters): void;
  /** Merge a partial into the current filters + push URL. */
  patch(part: Partial<ProductFilters>): void;
  /** Back to the route's base filters, stripping the query from the URL. */
  reset(): void;
  /** Number of non-default filters active (badge on the Filter button). */
  activeCount: number;
}

// URL <-> filter state without touching the Server Component's ISR.
//
// Rules (do not break -- see the refactor plan, decision #2):
//  - Initial state is `base`, NOT the parsed URL, so the first client render is
//    byte-identical to the SSR HTML (no hydration mismatch).
//  - After mount a one-off effect reads window.location.search and applies any
//    non-default params.
//  - URL writes use the native History API (pushState) instead of router.push,
//    so there is NO RSC round-trip for a page whose content doesn't depend on
//    the query. category/subcategory are NOT in the query (they're the path).
//  - A popstate listener restores state on back/forward.
//
// Accepted trade-off: opening a filtered link briefly shows the default view
// before the effect applies the URL -- far cheaper than losing ISR on the
// hottest route.
export function useCatalogFilters(base: ProductFilters): CatalogFiltersApi {
  const pathname = usePathname();
  const [filters, setFiltersState] = useState<ProductFilters>(base);

  const baseRef = useRef(base);
  baseRef.current = base;

  // Keep a live ref so patch() can read current filters without depending on
  // `filters` (and without side effects inside a setState updater).
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const writeUrl = useCallback(
    (next: ProductFilters) => {
      const qs = filtersToQuery(next).toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      window.history.pushState(null, "", url);
    },
    [pathname]
  );

  // Re-derive state from (base + URL) after mount AND whenever the route's base
  // changes. Mount-only was not enough: a navigation that changes only the
  // search params or a dynamic segment does NOT remount this component, so the
  // filters silently kept pointing at the previous route. The provable case is
  // /cari -- searching a second time pushes /cari?q=<new>, same route, and the
  // grid went on showing results for the old keyword.
  //
  // Deliberately keyed off `base` + `pathname` rather than useSearchParams():
  // this hook also runs inside CatalogPage, and useSearchParams() there would
  // force the statically-rendered category route to bail out to client
  // rendering, undoing its ISR (see the refactor plan, decision #2). On /cari
  // `base.search` follows ?q= anyway, so the effect still fires.
  const baseKey = `${base.category ?? ""}|${base.subcategory ?? ""}|${base.search ?? ""}`;
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setFiltersState(parseFiltersFromQuery(qs, baseRef.current));
  }, [baseKey, pathname]);

  // Restore on back/forward.
  useEffect(() => {
    const onPop = () => {
      const qs = new URLSearchParams(window.location.search);
      setFiltersState(parseFiltersFromQuery(qs, baseRef.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setFilters = useCallback(
    (next: ProductFilters) => {
      filtersRef.current = next;
      setFiltersState(next);
      writeUrl(next);
    },
    [writeUrl]
  );

  const patch = useCallback(
    (part: Partial<ProductFilters>) => {
      const next = { ...filtersRef.current, ...part };
      filtersRef.current = next;
      setFiltersState(next);
      writeUrl(next);
    },
    [writeUrl]
  );

  const reset = useCallback(() => {
    const next = { ...baseRef.current };
    filtersRef.current = next;
    setFiltersState(next);
    writeUrl(next);
  }, [writeUrl]);

  return { filters, setFilters, patch, reset, activeCount: countActiveFilters(filters) };
}
