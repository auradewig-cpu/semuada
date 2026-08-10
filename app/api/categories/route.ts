import { NextResponse } from "next/server";
import { getCategoryHierarchy } from "@root/lib/categories";

// The grouping logic used to be duplicated here and in lib/categories.ts, with
// a comment on each telling the next person to keep them in sync. One source
// now -- and this route picks up the selectDistinct fix for free.
export async function GET() {
  return NextResponse.json(await getCategoryHierarchy());
}
