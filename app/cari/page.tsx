import type { Metadata } from "next";
import SearchPage from "@/pages/SearchPage";

// Search results live at /cari?q=... -- a client-fetched page (deliberately not
// prefetched/ISR), so reading the query happens in the client SearchPage inside
// a Suspense boundary. Indexing a query-parameter page is meaningless, so block
// robots here (and in the client-embedded metadata) rather than let Google
// crawl every ?q= permutation.
export const metadata: Metadata = {
  title: "Cari Produk",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SearchPage />;
}
