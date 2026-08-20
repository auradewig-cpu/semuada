"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Clock } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  /** home = no per-page filter entry point; catalog = filter lives in SortBar. */
  variant: "home" | "catalog";
  activeCategory?: string;
  /** Initial value for the search input (e.g. the current /cari?q=). */
  initialSearch?: string;
}

const RECENT_KEY = "recentSearches";
const RECENT_MAX = 8;

// Replaces the old Header. The mobile hamburger that used to open the hidden
// filter panel is gone -- filtering now lives in the catalog SortBar / bottom
// sheet. The search bar owns its own value and submits to /cari?q= (a global
// search page), showing the last searches while the input is focused and empty.
export function SiteHeader({ variant, activeCategory, initialSearch = "" }: SiteHeaderProps) {
  const { data: settings } = useSettings();
  const router = useRouter();
  const siteName = settings?.site_name || "SEMUADA";

  const [q, setQ] = useState(initialSearch);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
  }, []);

  // Publish the header's live height so anything sticking below it (the catalog
  // SortBar, the desktop filter sidebar) can offset by the real value. The
  // height changes at the md breakpoint and again when the header shrinks on
  // scroll, which is why this is measured rather than hardcoded.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close the recent-searches dropdown when clicking outside any search box.
  // Matched by attribute rather than a ref because the header renders TWO
  // search boxes (desktop + mobile) and a single ref only ever held one of
  // them -- which made "outside" true for clicks inside the other one.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-searchbox]")) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    setFocused(false);
    router.push(`/cari?q=${encodeURIComponent(trimmed)}`);
  };

  const showRecent = focused && q.length === 0 && recent.length > 0;
  const SiteNameTag = variant === "home" ? "h1" : "span";

  // Shrink the logo/title on mobile once the user scrolls, so search keeps
  // prominence without eating vertical space.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const recentDropdown = showRecent ? (
    <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-xl shadow-lg z-50 p-2">
      <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Pencarian Terakhir</p>
      {recent.map((term) => (
        <button
          key={term}
          type="button"
          // preventDefault on mousedown keeps the input focused: without it the
          // input blurs first, which unmounts this dropdown before the click
          // can land, so the item was impossible to select.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => submit(term)}
          className="w-full flex items-center gap-2 px-2 py-2 min-h-[40px] text-sm text-left rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          {term}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm"
    >
      <div className={cn("container mx-auto px-4", scrolled ? "py-2" : "py-4")}>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 md:space-x-3" data-testid="link-home">
            {settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt={siteName}
                className={cn("rounded-xl object-contain transition-all", scrolled ? "w-7 h-7" : "w-8 h-8 md:w-10 md:h-10")}
              />
            ) : (
              <div
                className={cn(
                  "bg-gradient-to-br from-emerald to-metallic rounded-xl flex items-center justify-center transition-all",
                  scrolled ? "w-7 h-7" : "w-8 h-8 md:w-10 md:h-10"
                )}
              >
                <Store className={cn("text-white transition-all", scrolled ? "w-4 h-4" : "w-4 h-4 md:w-5 md:h-5")} />
              </div>
            )}
            {/* The site name is the page's h1 only on the homepage. On catalog
                and search pages the h1 belongs to the category/query heading --
                two h1s per page (site name first) buried the real one. */}
            <SiteNameTag
              className={cn(
                "font-bold bg-gradient-to-r from-emerald to-metallic bg-clip-text text-transparent transition-all hidden sm:block",
                scrolled ? "text-lg" : "text-2xl"
              )}
            >
              {siteName}
            </SiteNameTag>
          </Link>

          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full" data-searchbox>
              <SearchBar
                value={q}
                onChange={setQ}
                onSubmit={submit}
                onFocusChange={setFocused}
                category={variant === "catalog" ? activeCategory : undefined}
              />
              {recentDropdown}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>

        <div className={cn("md:hidden", scrolled ? "mt-1" : "mt-4")}>
          <div className="relative" data-searchbox>
            <SearchBar
              value={q}
              onChange={setQ}
              onSubmit={submit}
              onFocusChange={setFocused}
              category={variant === "catalog" ? activeCategory : undefined}
            />
            {recentDropdown}
          </div>
        </div>
      </div>
    </header>
  );
}
