import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "@/index.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEMUADA - Temukan Produk Terbaik",
  description: "Platform untuk mencari dan menemukan produk-produk terbaik dari berbagai kategori, dilengkapi dengan filter dan fitur admin.",
};

const FONT_AWESOME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css";
const FONT_AWESOME_INTEGRITY =
  "sha512-Fo3rlrZj/k7ujTnHg4CGR2D7kSs0v4LLanw2qksYuRlEzO+tcaEPQogQ0KaoGN26/zrn20ImR1DfuLWnOo7aBA==";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <head>
        <link
          rel="preload"
          as="style"
          href={FONT_AWESOME_URL}
          integrity={FONT_AWESOME_INTEGRITY}
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t);}catch(e){}function loadFA(){var l=document.createElement('link');l.rel='stylesheet';l.href='${FONT_AWESOME_URL}';l.integrity='${FONT_AWESOME_INTEGRITY}';l.crossOrigin='anonymous';l.referrerPolicy='no-referrer';document.head.appendChild(l);}if(document.readyState==='complete'){loadFA();}else{window.addEventListener('load',loadFA);}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
