"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { isStorefrontPath } from "@/lib/routes";

// Floating "back to top" button, fixed above the WhatsApp FAB (which sits at
// bottom-5 right-5). Appears only after the user scrolls past ~800px. Mounted
// globally in app/providers.tsx, so it needs the same storefront-only guard as
// SiteFooter.
export function BackToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible || !isStorefrontPath(pathname)) return null;

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-5 z-40 h-11 w-11 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
