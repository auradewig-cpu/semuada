import { desc, eq, sql } from "drizzle-orm";
import { db } from "@root/lib/db";
import { contentGenerations, products } from "@shared/schema";
import { HOOK_ARCHETYPES } from "./hookPatterns";
import type { HookArchetype } from "./types";

export interface RecentGeneration {
  hookArchetype: string | null;
  caption: string | null;
  hashtags: string[] | null;
  createdAt: Date | null;
}

// Anti-repetition is scoped per product (not per category) -- see the
// discussion this was designed from. Limit 3: enough to nudge variety
// without the prompt ballooning, and small relative to the 7 hook
// archetypes so suggestHookArchetype() almost always finds an unused one.
export async function getRecentGenerations(productId: string, limit = 3): Promise<RecentGeneration[]> {
  const rows = await db
    .select({
      hookArchetype: contentGenerations.hookArchetype,
      caption: contentGenerations.caption,
      hashtags: contentGenerations.hashtags,
      createdAt: contentGenerations.createdAt,
    })
    .from(contentGenerations)
    .where(eq(contentGenerations.productId, productId))
    .orderBy(desc(contentGenerations.createdAt))
    .limit(limit);
  return rows;
}

// Picks an archetype not seen in `recent`; falls back to the caller's
// default if every archetype has recently been used (rare given the limit).
export function suggestHookArchetype(recent: RecentGeneration[], fallback: HookArchetype): HookArchetype {
  const recentIds = new Set(recent.map((r) => r.hookArchetype).filter(Boolean));
  const candidates = Object.keys(HOOK_ARCHETYPES) as HookArchetype[];
  return candidates.find((id) => !recentIds.has(id)) ?? fallback;
}

// Usage counts per creative dimension, for the rotation/fatigue layer of the
// Creative Director. Returns { [id]: count } over the last `limit` generations
// in the given scope. These feed pickWeighted() in rotation.ts -- they do NOT
// include the (lighter) per-product history, which stays handled by
// buildAvoidRepetitionBlock.

export interface CreativeUsageCounts {
  styles: Record<string, number>;
  hooks: Record<string, number>;
  ctaTypes: Record<string, number>;
  tones: Record<string, number>;
  mechanisms: Record<string, number>;
}

function toUsageCounts(rows: { value: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (!r.value) continue;
    counts[r.value] = (counts[r.value] ?? 0) + 1;
  }
  return counts;
}

function toDimensionCounts(
  rows: { style: string | null; hook: string | null; cta: string | null; tone: string | null; mechanism: string | null }[]
): CreativeUsageCounts {
  return {
    styles: toUsageCounts(rows.map((r) => ({ value: r.style }))),
    hooks: toUsageCounts(rows.map((r) => ({ value: r.hook }))),
    ctaTypes: toUsageCounts(rows.map((r) => ({ value: r.cta }))),
    tones: toUsageCounts(rows.map((r) => ({ value: r.tone }))),
    mechanisms: toUsageCounts(rows.map((r) => ({ value: r.mechanism }))),
  };
}

// content_generations has no category column, so category-scoped usage is
// derived by joining through products on product_id -- product_id is text while
// products.id is uuid, hence the ::text casts on both sides.
async function usageWithin(category: string | undefined, limit: number): Promise<CreativeUsageCounts> {
  const select = {
    style: contentGenerations.style,
    hook: contentGenerations.hookArchetype,
    cta: contentGenerations.ctaType,
    tone: contentGenerations.languageTone,
    mechanism: contentGenerations.mechanism,
  };

  if (category) {
    const rows = await db
      .select(select)
      .from(contentGenerations)
      .innerJoin(products, sql`${contentGenerations.productId}::text = ${products.id}::text`)
      .where(eq(products.category, category))
      .orderBy(desc(contentGenerations.createdAt))
      .limit(limit);
    return toDimensionCounts(rows);
  }

  const rows = await db
    .select(select)
    .from(contentGenerations)
    .orderBy(desc(contentGenerations.createdAt))
    .limit(limit);
  return toDimensionCounts(rows);
}

/** Last `limit` generations in the same category (this is the genuinely new
 *  scope -- 4 different products all on before_after still feels uniform to a
 *  viewer, so category-level fatigue matters). */
export async function getCategoryUsageCounts(category: string, limit = 20): Promise<CreativeUsageCounts> {
  return usageWithin(category, limit);
}

/** Last `limit` generations across all categories. */
export async function getGlobalUsageCounts(limit = 20): Promise<CreativeUsageCounts> {
  return usageWithin(undefined, limit);
}

// Empty string when there's no history -- keeps the prompt byte-identical to
// today's behavior for a product's first-ever generation.
export function buildAvoidRepetitionBlock(recent: RecentGeneration[]): string {
  if (recent.length === 0) return "";
  const lines = recent
    .map((r) => {
      const archetypeLabel = r.hookArchetype ? HOOK_ARCHETYPES[r.hookArchetype as HookArchetype]?.label ?? r.hookArchetype : "-";
      const hashtags = (r.hashtags ?? []).map((h) => `#${h.replace(/^#+/, "")}`).join(" ");
      return `- Hook: ${archetypeLabel} | Caption: "${r.caption ?? "-"}" | Hashtag: ${hashtags || "-"}`;
    })
    .join("\n");
  return `\nRIWAYAT KONTEN SEBELUMNYA UNTUK PRODUK INI (WAJIB DIHINDARI PENGULANGANNYA -- buat hook, caption, gaya bahasa, DAN kombinasi hashtag yang BERBEDA dari daftar berikut, jangan pakai frasa/struktur kalimat yang mirip; hashtag boleh overlap 1-2 kata paling relevan kalau memang wajib, tapi JANGAN salin ulang 5 hashtag yang sama persis):\n${lines}\n`;
}
