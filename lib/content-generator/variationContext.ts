import { desc, eq } from "drizzle-orm";
import { db } from "@root/lib/db";
import { contentGenerations } from "@shared/schema";
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
  return `\nRIWAYAT KONTEN SEBELUMNYA UNTUK PRODUK INI (WAJIB DIHINDARI PENGULANGANNYA -- buat hook, caption, dan gaya bahasa yang BERBEDA dari daftar berikut, jangan pakai frasa/struktur kalimat yang mirip):\n${lines}\n`;
}
