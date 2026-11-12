import type { RosterEntry } from '@/data/roster';

/**
 * Mulberry32 deterministic PRNG so each contributor gets a reproducible shuffled
 * order of the 22 classmate folders stored with their session seed.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const rand = mulberry32(seed || 1337);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateSeed(): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return (arr[0] % 2000000000) + 1;
  }
  return Math.floor(Math.random() * 2000000000) + 1;
}

export function getShuffledClassmates(
  allRoster: readonly RosterEntry[],
  selfRosterId: string | null | undefined,
  seed: number
): RosterEntry[] {
  const others = allRoster.filter((entry) => entry.id !== selfRosterId);
  return seededShuffle(others, seed);
}
