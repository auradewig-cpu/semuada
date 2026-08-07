import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@root/lib/apiAuth";
import { getRecentGenerations, suggestHookArchetype } from "@root/lib/content-generator/variationContext";
import { HOOK_ARCHETYPES } from "@root/lib/content-generator/hookPatterns";

// Same default as ContentGeneratorTab.tsx's initial hookArchetype state --
// used only as the fallback when a product has no generation history yet.
const DEFAULT_ARCHETYPE = "specific_outcome" as const;

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId wajib diisi." }, { status: 400 });
  }

  const recent = await getRecentGenerations(productId);
  const suggested = suggestHookArchetype(recent, DEFAULT_ARCHETYPE);

  return NextResponse.json({
    suggested_archetype: suggested,
    recent: recent.map((r) => ({
      hook_archetype: r.hookArchetype,
      hook_archetype_label: r.hookArchetype ? HOOK_ARCHETYPES[r.hookArchetype as keyof typeof HOOK_ARCHETYPES]?.label ?? r.hookArchetype : null,
      caption: r.caption,
      created_at: r.createdAt,
    })),
  });
}
