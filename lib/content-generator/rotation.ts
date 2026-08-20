// Weighted rotation with usage fatigue -- the pure, DB-free core of the
// Creative Director's fallback and the "auto" selection. Candidates used often
// recently get a probability penalty; rarely-used ones get boosted -- neither
// fully random (which ignores history) nor fully "always pick the rarest"
// (which becomes a readable pattern too).

export interface UsageCounts {
  [id: string]: number;
}

// Deterministic PRNG from a seed so the same inputs always pick the same way
// (lets tests assert distribution). NOT cryptographically random -- good enough
// for creative rotation.
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Picks one id from `candidates` weighted inversely to its usage count.
 * `fatigue` controls how strongly history suppresses a candidate (0 = uniform).
 * Deterministic for a given seed, so a test can simulate N consecutive picks.
 */
export function pickWeighted(
  candidates: string[],
  usageCounts: UsageCounts,
  seed: number,
  fatigue = 0.6
): string {
  if (candidates.length === 0) throw new Error("pickWeighted: no candidates");
  if (candidates.length === 1) return candidates[0];

  const counts = candidates.map((c) => usageCounts[c] ?? 0);
  const maxUsage = Math.max(...counts, 0);
  // weight = 1 + (maxUsage - count) * fatigue  -> the least-used gets the
  // biggest boost; the most-used still keeps weight 1 (never zero, so it is
  // not impossible, just unlikely).
  const weights = counts.map((count) => 1 + (maxUsage - count) * fatigue);
  const total = weights.reduce((a, b) => a + b, 0);

  let r = seededRandom(seed) * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Merges usage counts from several scopes into one, with a per-scope emphasis
 * multiplier (e.g. the category's last 20 generations weigh more than global).
 */
export function mergeUsageCounts(scopes: { counts: UsageCounts; weight: number }[]): UsageCounts {
  const merged: UsageCounts = {};
  for (const scope of scopes) {
    for (const [id, count] of Object.entries(scope.counts)) {
      merged[id] = (merged[id] ?? 0) + count * scope.weight;
    }
  }
  return merged;
}
