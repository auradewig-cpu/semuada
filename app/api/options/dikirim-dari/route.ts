import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLocationOptions } from "@root/lib/productOptions";

// GET /api/options/dikirim-dari?category=&subcategory=
// Returns distinct locations as {value, count}, ordered by count desc, scoped
// to the category/subcategory when given. This is the "Lokasi" filter (the
// shop's origin, not a delivery service). The query itself lives in
// lib/productOptions.ts because the category pages prefetch the same data
// server-side -- keeping one implementation means the two cannot disagree.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const subcategory = params.get("subcategory") ?? undefined;

  return NextResponse.json(await getLocationOptions(category, subcategory));
}
