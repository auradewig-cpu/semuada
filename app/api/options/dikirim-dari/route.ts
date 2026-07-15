import { NextResponse } from "next/server";
import { and, isNotNull, ne } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";

export async function GET() {
  const rows = await db
    .select({ dikirim_dari: products.dikirim_dari })
    .from(products)
    .where(and(isNotNull(products.dikirim_dari), ne(products.dikirim_dari, "")));

  const values = Array.from(new Set(rows.map((r) => r.dikirim_dari).filter(Boolean) as string[])).sort();
  return NextResponse.json(values);
}
