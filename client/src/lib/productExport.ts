import Papa from "papaparse";
import type { Product } from "@/types";
import { slugify } from "@/lib/utils";

// Product export: the plain CSV, and the ZIP that pairs that same CSV with
// each product's main image named by its row number (1.webp = row 1).
//
// Both are built from ONE list, snapshotted at the moment of the click, so
// row N of the CSV and N.webp can never drift apart. Exporting them as two
// separate downloads could: a scraper run landing in between shifts every
// row after the new product by one, and nothing would show it.

// Column order is what Export CSV has always produced, and what Import CSV
// reads back (it maps by header name, see ProductManagementTab).
export const EXPORT_COLUMNS = [
  "product_id",
  "product_name",
  "category",
  "subcategory",
  "original_price",
  "price",
  "sales",
  "item",
  "komisi",
  "dikirim_dari",
  "toko",
  "affiliate_url",
  "image_url",
  "image_url_2",
  "image_url_3",
  "image_url_4",
  "image_url_5",
  "video_url",
  "is_featured",
  "featured_order",
  "rating",
  "stock_available",
] as const;

type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], unknown>;

export function toExportRow(product: Product): ExportRow {
  return {
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category,
    subcategory: product.subcategory,
    original_price: product.original_price,
    price: product.price,
    sales: product.sales,
    item: (product as any).item || "",
    // 'komisi' is the column name the database and Import CSV use.
    komisi: product.commission,
    dikirim_dari: product.dikirim_dari,
    toko: product.toko,
    affiliate_url: product.affiliate_url,
    image_url: product.image_url,
    image_url_2: product.image_urls?.[0] || "",
    image_url_3: product.image_urls?.[1] || "",
    image_url_4: product.image_urls?.[2] || "",
    image_url_5: product.image_urls?.[3] || "",
    video_url: (product as any).video_url || "",
    is_featured: product.is_featured ?? "",
    featured_order: product.featured_order ?? "",
    rating: product.rating ?? "",
    stock_available: (product as any).stock_available ?? "",
  };
}

// Every field quoted, "\n" line endings and a UTF-8 BOM (so Excel reads the
// Indonesian text correctly) -- the same shape react-csv produced, with one
// difference that matters: embedded double quotes are escaped as "".
// react-csv wrapped values in quotes WITHOUT escaping them, so the 24
// product names containing a `"` (inch sizes and the like) came out as
// malformed rows that spreadsheets and the importer split in the wrong place.
export function buildExportCsv(products: Product[]): string {
  const csv = Papa.unparse(
    {
      fields: [...EXPORT_COLUMNS],
      data: products.map((p) => {
        const row = toExportRow(p);
        return EXPORT_COLUMNS.map((c) => row[c] ?? "");
      }),
    },
    { quotes: true, newline: "\n" }
  );
  return `﻿${csv}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later rather than immediately: some browsers start reading the
  // blob only after click() has returned.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadExportCsv(products: Product[]) {
  downloadBlob(new Blob([buildExportCsv(products)], { type: "text/csv;charset=utf-8" }), "products-export.csv");
}

// "elektronik-export.zip", "elektronik-perangkat-dapur-export.zip", or
// "products-export.zip" when no category filter is active.
export function exportZipName(category?: string, subcategory?: string): string {
  const parts = [category, subcategory].filter((p): p is string => Boolean(p)).map(slugify).filter(Boolean);
  return `${parts.length > 0 ? parts.join("-") : "products"}-export.zip`;
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function imageExtension(contentType: string | null, url: URL): string {
  const bare = contentType?.split(";")[0].trim().toLowerCase();
  if (bare && EXT_BY_CONTENT_TYPE[bare]) return EXT_BY_CONTENT_TYPE[bare];
  const fromPath = /\.([a-z0-9]{2,5})$/i.exec(url.pathname)?.[1]?.toLowerCase();
  return fromPath || "jpg";
}

const FETCH_TIMEOUT_MS = 20_000;
const ATTEMPTS = 2;
// Parallel downloads. Enough to finish a 500-product category in well under a
// minute, few enough not to look like a flood to the image CDN.
const CONCURRENCY = 6;

async function fetchImage(url: URL): Promise<{ bytes: ArrayBuffer; ext: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      // Straight from the browser to the image host. Shopee's CDN answers
      // with Access-Control-Allow-Origin: *, so this needs no server proxy --
      // which also keeps a 500-image ZIP clear of Vercel's 4.5 MB response cap.
      const res = await fetch(url.toString(), { signal: controller.signal, credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) throw new Error("file kosong");
      return { bytes, ext: imageExtension(res.headers.get("content-type"), url) };
    } catch (err) {
      lastError = controller.signal.aborted ? new Error("timeout") : err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface FailedImage {
  row: number;
  product: Product;
  reason: string;
}

// products-export.csv + one main image per row, named by row number.
//
// A row whose image fails keeps its number: no file is written for it and
// every later file stays aligned with its own CSV row (7.webp is still row 7
// when 6.webp is missing). Failures are listed in gagal.txt inside the ZIP.
export async function buildExportZip(
  products: Product[],
  onProgress?: (done: number, total: number) => void
): Promise<{ blob: Blob; failed: FailedImage[] }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("products-export.csv", buildExportCsv(products));

  const failed: FailedImage[] = [];
  let next = 0;
  let done = 0;
  onProgress?.(0, products.length);

  const worker = async () => {
    while (next < products.length) {
      const index = next++;
      const row = index + 1;
      const product = products[index];
      try {
        const raw = (product.image_url || "").trim();
        if (!raw) throw new Error("tidak ada image_url");
        const url = new URL(raw);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("URL tidak valid");
        const { bytes, ext } = await fetchImage(url);
        zip.file(`${row}.${ext}`, bytes);
      } catch (err) {
        failed.push({ row, product, reason: err instanceof Error ? err.message : String(err) });
      }
      done++;
      onProgress?.(done, products.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, products.length) }, worker));

  if (failed.length > 0) {
    failed.sort((a, b) => a.row - b.row);
    const lines = failed.map(
      (f) => `${f.row}\t${f.product.product_id ?? ""}\t${f.product.product_name ?? ""}\t${f.product.image_url ?? ""}\t${f.reason}`
    );
    zip.file("gagal.txt", `﻿baris\tproduct_id\tproduct_name\timage_url\talasan\n${lines.join("\n")}\n`);
  }

  // Images are already compressed (webp); STORE skips a pointless re-deflate.
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, failed };
}
