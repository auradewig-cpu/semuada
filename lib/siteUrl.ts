// Canonical public origin, used by sitemap.xml and robots.txt.
//
// The fallback used to be the semuada-three.vercel.app deployment URL, which
// 307-redirects to the real domain -- so every URL both files emitted pointed
// at a redirect. That was survivable while the sitemap held 5 entries; it now
// holds 121. NEXT_PUBLIC_SITE_URL still wins if set, but the default is the
// domain actually being served.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://daftarproduct.id";
