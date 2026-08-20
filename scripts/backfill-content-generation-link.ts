// One-time backfill: link video_contents rows back to the content_generations
// that produced them, matching by caption text -- but ONLY when the caption
// maps to exactly one generation. Ambiguous and unmatched rows are left NULL;
// never guess. Run once after Phase 0 columns exist:
//
//   npx tsx scripts/backfill-content-generation-link.ts
//
// Expected: ~288 of 339 videos get linked (the rest stay null because their
// caption is ambiguous or absent). Every upload from Content Generator going
// forward sets the FK directly, so this never needs to run again.

import { db } from "@root/lib/db";
import { contentGenerations, videoContents } from "@shared/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

async function main() {
  const unlinked = await db
    .select({ id: videoContents.id, caption: videoContents.caption })
    .from(videoContents)
    .where(and(isNull(videoContents.contentGenerationId), isNotNull(videoContents.caption)));

  // Group candidate generations by caption so each video does one lookup.
  const byCaption = new Map<string, string[]>();
  const generations = await db
    .select({ id: contentGenerations.id, caption: contentGenerations.caption })
    .from(contentGenerations)
    .where(isNotNull(contentGenerations.caption));
  for (const g of generations) {
    const key = g.caption;
    const arr = byCaption.get(key);
    if (arr) arr.push(g.id);
    else byCaption.set(key, [g.id]);
  }

  let linked = 0;
  let ambiguous = 0;
  let unmatched = 0;

  for (const v of unlinked) {
    const ids = byCaption.get(v.caption ?? "");
    if (!ids || ids.length === 0) {
      unmatched++;
      continue;
    }
    if (ids.length !== 1) {
      ambiguous++;
      continue;
    }
    await db
      .update(videoContents)
      .set({ contentGenerationId: ids[0] })
      .where(eq(videoContents.id, v.id));
    linked++;
  }

  console.log(`Linked: ${linked}, ambiguous (left null): ${ambiguous}, unmatched (left null): ${unmatched}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
