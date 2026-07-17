import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://semuada-three.vercel.app";

  const staticRoutes = ["", "/faq", "/how-to-shop", "/privacy-policy", "/terms-and-conditions"];

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));
}
