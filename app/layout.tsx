import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";
import { getApiSiteSettings, getSiteSettings } from "@root/lib/site-settings";
import { getCategoryHierarchy } from "@root/lib/categories";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "@/index.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

// Site-wide (every page needs it, via the globally-mounted CategoryProvider
// in app/providers.tsx) -- cached the same way app/page.tsx caches its own
// prefetches, so this doesn't force every page under this layout to become
// fully dynamic.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteTagline, faviconUrl, seoMetaDescription, ogImageUrl } = await getSiteSettings();
  const description =
    seoMetaDescription ||
    (siteTagline
      ? `${siteTagline} — ${siteName}`
      : "Platform untuk mencari dan menemukan produk-produk terbaik dari berbagai kategori, dilengkapi dengan filter dan fitur admin.");

  return {
    title: `${siteName} - Temukan Produk Terbaik`,
    description,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
    openGraph: {
      title: `${siteName} - Temukan Produk Terbaik`,
      description,
      images: ogImageUrl ? [{ url: ogImageUrl }] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();
  const [hierarchy, siteSettings] = await Promise.all([
    getCategoryHierarchy(),
    // Settings are prefetched HERE, not in a page: SiteHeader lives inside the
    // page tree but SiteFooter is mounted by this layout, so a page-level
    // prefetch never reached the footer -- and every non-home route rendered
    // the "SEMUADA" fallback name/logo server-side before swapping to the real
    // one after an /api/settings round-trip.
    getApiSiteSettings(),
  ]);
  queryClient.setQueryData(["categoryHierarchy"], hierarchy);
  queryClient.setQueryData(["settings"], siteSettings);
  const dehydratedState = dehydrate(queryClient);

  return (
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='light';}document.documentElement.classList.add(t);}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans">
        <Providers dehydratedState={dehydratedState}>
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
