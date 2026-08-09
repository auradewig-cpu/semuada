import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { getSiteSettings } from "@root/lib/site-settings";
import "@/index.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
