// Which routes are "the storefront". Used by the globally-mounted chrome
// (SiteFooter, BackToTop) that lives in app/layout.tsx / app/providers.tsx:
// neither app/admin/** nor app/maintenance has its own layout to opt out with,
// so without this the storefront footer rendered under the admin dashboard.
const NON_STOREFRONT_PREFIXES = ["/admin", "/maintenance"];

export function isStorefrontPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return !NON_STOREFRONT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
