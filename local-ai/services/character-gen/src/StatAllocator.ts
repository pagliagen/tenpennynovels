import { GeneratedStats } from './types';

const STATS_KEYS: (keyof GeneratedStats)[] = [
  'strength', 'dexterity', 'intelligence', 'constitution',
  'appearance', 'size', 'power', 'education',
];

const STAT_MIN = 20;
const STAT_MAX = 85;
const MAX_ABOVE_80 = 2;

/**
 * Distributes stat points according to Call of Cthulhu rules:
 * - Total = statsBudget (default 450)
 * - Min per stat: 20
 * - Max per stat: 85
 * - At most 2 stats can exceed 80
 *
 * Uses AI-suggested weights (0-1 per stat) to guide distribution.
 */
export function allocateStats(
  weights: Partial<Record<keyof GeneratedStats, number>>,
  budget: number = 450
): GeneratedStats {
  const normalWeights: Record<keyof GeneratedStats, number> = {
    strength: 1, dexterity: 1, intelligence: 1, constitution: 1,
    appearance: 1, size: 1, power: 1, education: 1,
  };

  for (const key of STATS_KEYS) {
    if (weights[key] !== undefined) {
      normalWeights[key] = Math.max(0.1, Math.min(2.0, weights[key]!));
    }
  }

  const totalWeight = STATS_KEYS.reduce((s, k) => s + normalWeights[k], 0);
  const basePoints = budget - STAT_MIN * 8;
  const extra = budget - STAT_MIN * 8;

  let result: Record<keyof GeneratedStats, number> = {
    strength: STAT_MIN, dexterity: STAT_MIN, intelligence: STAT_MIN,
    constitution: STAT_MIN, appearance: STAT_MIN, size: STAT_MIN,
    power: STAT_MIN, education: STAT_MIN,
  };

  // Proportional distribution
  let remaining = extra;
  const additions: Record<keyof GeneratedStats, number> = {} as any;

  for (const key of STATS_KEYS) {
    const raw = Math.round((normalWeights[key] / totalWeight) * basePoints);
    additions[key] = raw;
    remaining -= raw;
  }

  // Distribute remainder to highest-weight stats
  const sorted = [...STATS_KEYS].sort((a, b) => normalWeights[b] - normalWeights[a]);
  let i = 0;
  while (remaining > 0) {
    additions[sorted[i % 8]] += 1;
    remaining -= 1;
    i++;
  }
  while (remaining < 0) {
    additions[sorted[i % 8]] -= 1;
    remaining += 1;
    i++;
  }

  for (const key of STATS_KEYS) {
    result[key] = STAT_MIN + Math.max(0, additions[key]);
  }

  // Enforce caps
  result = capStats(result);

  // Normalize sum to exactly budget
  result = normalizeSumTo(result, budget);

  return result;
}

function capStats(stats: Record<keyof GeneratedStats, number>): Record<keyof GeneratedStats, number> {
  const result = { ...stats };

  // Cap all to STAT_MAX
  for (const key of STATS_KEYS) {
    if (result[key] > STAT_MAX) result[key] = STAT_MAX;
    if (result[key] < STAT_MIN) result[key] = STAT_MIN;
  }

  // Enforce max MAX_ABOVE_80 stats > 80
  const above80 = STATS_KEYS.filter(k => result[k] > 80).sort((a, b) => result[b] - result[a]);
  for (let i = MAX_ABOVE_80; i < above80.length; i++) {
    result[above80[i]] = 80;
  }

  return result;
}

function normalizeSumTo(stats: Record<keyof GeneratedStats, number>, target: number): Record<keyof GeneratedStats, number> {
  const result = { ...stats };
  let sum = STATS_KEYS.reduce((s, k) => s + result[k], 0);
  const diff = target - sum;

  if (diff === 0) return result;

  // Adjust by distributing diff across stats within bounds
  const sorted = [...STATS_KEYS].sort((a, b) => result[a] - result[b]);
  let remaining = diff;

  for (const key of diff > 0 ? sorted.reverse() : sorted) {
    if (remaining === 0) break;
    const delta = diff > 0 ? Math.min(remaining, STAT_MAX - result[key]) : Math.max(remaining, STAT_MIN - result[key]);
    result[key] += delta;
    remaining -= delta;
  }

  return result;
}
