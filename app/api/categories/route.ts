import { NextResponse } from "next/server";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export async function GET() {
  const rows = await db
    .select({ category: products.category, subcategory: products.subcategory })
    .from(products);

  const hierarchy: Record<string, string[]> = {};
  const seen: Record<string, Set<string>> = {};

  for (const row of rows) {
    if (!row.category) continue;
    if (!seen[row.category]) {
      seen[row.category] = new Set();
      hierarchy[row.category] = [];
    }
    if (row.subcategory && !seen[row.category].has(row.subcategory)) {
      seen[row.category].add(row.subcategory);
      hierarchy[row.category].push(row.subcategory);
    }
  }

  return NextResponse.json(hierarchy);
}
