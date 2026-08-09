import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";
import { getSiteSettings } from "@root/lib/site-settings";
import { getCategoryHierarchy } from "@root/lib/categories";
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
  queryClient.setQueryData(["categoryHierarchy"], await getCategoryHierarchy());
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
        <Providers dehydratedState={dehydratedState}>{children}</Providers>
      </body>
    </html>
  );
}
