import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { asc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { products } from "@shared/schema";
import { toApiProduct } from "@root/lib/mappers";
import Home from "@/pages/Home";

export const revalidate = 60;

export default async function Page() {
  const queryClient = new QueryClient();

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.isFeatured, true))
    .orderBy(asc(products.featuredOrder))
    .limit(100);

  queryClient.setQueryData(["featuredProducts", undefined], rows.map(toApiProduct));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Home />
    </HydrationBoundary>
  );
}
