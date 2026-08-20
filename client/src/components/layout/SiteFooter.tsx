"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Facebook, Twitter, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { useCategoryContext } from "@/context/CategoryContext";
import { useSettings } from "@/hooks/useSettings";
import { isStorefrontPath } from "@/lib/routes";
import { slugify } from "@/lib/utils";

// Extracted from the old Home.tsx footer so it can be mounted globally in
// app/layout.tsx -- this also gives /faq, /how-to-shop, /privacy-policy and
// /terms-and-conditions a footer, which they previously lacked.
//
// Mounted in the root layout, so it would otherwise also land on /admin/** and
// /maintenance (neither has its own layout to opt out with) -- the storefront
// footer under the admin dashboard. Hence the path guard.
export function SiteFooter() {
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const siteName = settings?.site_name || "SEMUADA";

  if (!isStorefrontPath(pathname)) return null;

  return (
    <footer className="bg-card border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              {settings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logo_url} alt={siteName} className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-emerald to-metallic rounded-lg flex items-center justify-center">
                  <Store className="w-4 h-4 text-white" />
                </div>
              )}
              <h3 className="text-lg font-bold bg-gradient-to-r from-emerald to-metallic bg-clip-text text-transparent">
                {siteName}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              {settings?.site_tagline || "Platform untuk mencari dan menemukan produk-produk terbaik dari berbagai kategori."}
            </p>
            {(settings?.social_facebook_url || settings?.social_twitter_url || settings?.social_instagram_url) && (
              <div className="flex space-x-3">
                {settings?.social_facebook_url && (
                  <a href={settings.social_facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-8 h-8 bg-emerald text-white rounded-lg flex items-center justify-center hover:bg-emerald/80 transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {settings?.social_twitter_url && (
                  <a href={settings.social_twitter_url} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="w-8 h-8 bg-metallic text-white rounded-lg flex items-center justify-center hover:bg-metallic/80 transition-colors">
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {settings?.social_instagram_url && (
                  <a href={settings.social_instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-8 h-8 bg-violet text-white rounded-lg flex items-center justify-center hover:bg-violet/80 transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-4">Kategori</h4>
            {isCategoryLoading ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[...Array(4)].map((_, i) => <li key={i}><div className="h-4 bg-muted rounded w-2/3"></div></li>)}
              </ul>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {Array.from(hierarchy.keys()).slice(0, 5).map((category) => (
                  <li key={category}>
                    <Link href={`/${slugify(category)}`} className="hover:text-emerald transition-colors">
                      {category}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-4">Bantuan</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/faq" className="hover:text-emerald transition-colors">FAQ</Link></li>
              <li><Link href="/how-to-shop" className="hover:text-emerald transition-colors">Cara Berbelanja</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-emerald transition-colors">Kebijakan Privasi</Link></li>
              <li><Link href="/terms-and-conditions" className="hover:text-emerald transition-colors">Syarat & Ketentuan</Link></li>
            </ul>
          </div>

          {(settings?.contact_email || settings?.contact_phone || settings?.contact_address) && (
            <div>
              <h4 className="font-semibold mb-4">Kontak</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {settings?.contact_email && (
                  <p className="flex items-center"><Mail className="w-4 h-4 text-emerald mr-2" /> {settings.contact_email}</p>
                )}
                {settings?.contact_phone && (
                  <p className="flex items-center"><Phone className="w-4 h-4 text-emerald mr-2" /> {settings.contact_phone}</p>
                )}
                {settings?.contact_address && (
                  <p className="flex items-center"><MapPin className="w-4 h-4 text-emerald mr-2" /> {settings.contact_address}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span className="text-xs text-muted-foreground">Powered by</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-emerald font-semibold">Neon</span>
              <span className="text-xs text-metallic font-semibold">Next.js</span>
              <span className="text-xs text-violet font-semibold">Tailwind</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
