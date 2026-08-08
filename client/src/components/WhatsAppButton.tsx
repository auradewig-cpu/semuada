"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

// Floating WhatsApp CTA for storefront pages -- mirrors TrackingScripts'
// pattern of reading a single settings field and rendering nothing when
// it's unset. Skipped on /admin routes since it's a customer-facing CTA.
export function WhatsAppButton() {
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const rawNumber = settings?.whatsapp_number;
  if (!rawNumber || pathname?.startsWith("/admin")) return null;

  const digitsOnly = rawNumber.replace(/[^0-9]/g, "");
  if (!digitsOnly) return null;

  return (
    <a
      href={`https://wa.me/${digitsOnly}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat via WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-110 transition-all"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
