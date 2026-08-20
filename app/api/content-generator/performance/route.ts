import { NextResponse } from "next/server";
import { requireAuth } from "@root/lib/apiAuth";
import { buildPerformanceReport } from "@root/lib/content-generator/performance";

// Admin-only, read-only performance report for the Content Generator learning
// (Phase 5). Recommendations only -- never mutates anything.
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const report = await buildPerformanceReport();
  return NextResponse.json(report);
}
