import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { schedulerAccounts, videoContents } from "@shared/schema";
import { requireAuth } from "@root/lib/apiAuth";

// Which accounts already hold videos of this product in their lane, and how
// many. Powers the contamination warning shown before an assignment.
//
// The whole point of lanes is that one account owns a run of near-identical
// videos for one product. Putting some of that product on a SECOND account
// recreates exactly the cross-account similarity the lanes exist to prevent --
// and that has already happened here: KUCADI Kursi Malas went out on both Caca
// Anindya and Naya Ardelia. This endpoint is what lets the UI say so before the
// mistake is saved.
//
// Advisory only, never blocking: deliberately moving a product's focus from one
// account to another is a legitimate thing to do.
export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const productId = request.nextUrl.searchParams.get("product_id");
  if (!productId) {
    return NextResponse.json({ error: "product_id wajib diisi." }, { status: 400 });
  }

  // ::int because Postgres count(*) is bigint, which the Neon driver returns as
  // a STRING -- the same trap documented in the stats route.
  const rows = await db
    .select({
      scheduler_account_id: videoContents.schedulerAccountId,
      label: schedulerAccounts.label,
      count: sql<number>`count(*)::int`,
    })
    .from(videoContents)
    .innerJoin(schedulerAccounts, eq(schedulerAccounts.id, videoContents.schedulerAccountId))
    .where(
      and(
        eq(videoContents.productId, productId),
        isNotNull(videoContents.schedulerAccountId),
        isNull(videoContents.trashedAt)
      )
    )
    .groupBy(videoContents.schedulerAccountId, schedulerAccounts.label)
    .orderBy(sql`count(*) desc`);

  return NextResponse.json({ items: rows });
}
