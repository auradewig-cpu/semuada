import type { MetadataRoute } from "next";
import { getCategoryParams, getSubcategoryParams } from "@root/lib/categories";
import { SITE_URL } from "@root/lib/siteUrl";

// Cheap to regenerate and nowhere near as time-sensitive as the storefront
// itself, but it does hit the DB now, so give it its own ISR window rather
// than letting the query make this route fully dynamic.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const staticRoutes = ["", "/faq", "/how-to-shop", "/privacy-policy", "/terms-and-conditions"];

  // Same slug source the category routes prerender from (lib/categories.ts), so
  // the sitemap can't drift from what actually resolves -- these 100+ pages were
  // previously missing from it entirely.
  const [categories, subcategories] = await Promise.all([
    getCategoryParams(),
    getSubcategoryParams(),
  ]);

  const lastModified = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified,
    })),
    ...categories.map(({ category }) => ({
      url: `${baseUrl}/${category}`,
      lastModified,
    })),
    ...subcategories.map(({ category, subcategory }) => ({
      url: `${baseUrl}/${category}/${subcategory}`,
      lastModified,
    })),
  ];
}
