// Mirrors next.config.mjs's images.remotePatterns -- keep both in sync
// manually if the allowed domains ever change (next.config.mjs can't be
// imported here since it isn't part of the app's module graph). Without
// this check, a product image URL from an un-whitelisted domain saves fine
// but then next/image throws a runtime error wherever it's rendered on the
// public site -- a silent, delayed break instead of a clear error at save
// time.
const ALLOWED_IMAGE_HOSTNAME_SUFFIXES = [".susercontent.com"];
const ALLOWED_IMAGE_HOSTNAMES = ["images.unsplash.com"];

export function isAllowedImageUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    ALLOWED_IMAGE_HOSTNAMES.includes(hostname) ||
    ALLOWED_IMAGE_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

// Shared by both the product POST and PUT routes -- checks image_url and
// every entry of image_urls (both optional/untyped on a raw request body),
// returning an error message for the first disallowed one found, or null if
// everything's fine.
export function findInvalidImageUrl(body: { image_url?: unknown; image_urls?: unknown }): string | null {
  const candidates: unknown[] = [body.image_url, ...(Array.isArray(body.image_urls) ? body.image_urls : [])];
  for (const url of candidates) {
    if (typeof url === "string" && url && !isAllowedImageUrl(url)) {
      return `URL gambar "${url}" berasal dari domain yang tidak diizinkan. Gunakan gambar dari Shopee atau Unsplash.`;
    }
  }
  return null;
}
