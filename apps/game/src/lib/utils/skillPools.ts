/**
 * Skill Point Pools
 *
 * Three skill-point pools during character creation:
 * - Base pool: flat, spendable on any skill regardless of type.
 * - Occupation pool (EDU x N): spendable ONLY on occupation-eligible skills.
 * - Hobby pool (INT x N): spendable ONLY on non-occupation skills.
 *
 * Spend order: the base pool is drawn FIRST for every skill, no matter its type;
 * only once base is exhausted does additional spend fall to the skill's own
 * earmarked pool (EDU x N for occupation skills, INT x N otherwise).
 *
 * How much of base each type has claimed (`baseClaimedByOcc`/`baseClaimedByHobby`)
 * is NOT recomputed here - it's tracked incrementally in the wizard store
 * (updateSkill, autoAssignRequiredSkills) as points actually change, in the order
 * they actually change. A stateless recompute from a `skills` snapshot alone
 * cannot tell "these points came from base" from "these overflowed", since a
 * plain object has no meaningful order - that was the bug in an earlier version
 * of this file. This module only classifies and sums; it doesn't decide history.
 *
 * Mirrors the server-side authoritative check in
 * services/unified-backend/src/modules/game/utils/characterCreationUtils.ts
 * (buildOccupationSkillSet + the feasibility check in validateCharacterSubmission) -
 * keep the two in sync if the classification or feasibility rule changes.
 *
 * @module lib/utils/skillPools
 */

import type { CharacterCreationConfig } from '@/lib/api/character';
import type { DynamicSkill, SkillBreakdown, WizardOccupation, WizardStats } from '@/types/wizard';

/**
 * Parse and evaluate a stat-derived formula. Regex-only, no eval - this runs in
 * the browser. Supports: {TOKEN}/N, {TOKEN}xN, {TOKEN}+N, {TOKEN}-N, constant:N.
 * Same formula dialect as the backend's calculateStatFormula (CharacterCreationConfigService.ts).
 */
export function evalStatFormula(formula: string | undefined, token: string, value: number): number {
  const fallback = Math.floor(value / 2);
  if (!formula) return fallback;

  if (formula.startsWith('constant:')) {
    const parsed = parseInt(formula.replace('constant:', ''), 10);
    return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  }

  const match = formula
    .replace(/x/gi, '*')
    .match(new RegExp(`^${token}\\s*([+\\-*/])\\s*(\\d+(?:\\.\\d+)?)$`, 'i'));

  if (!match) return fallback;

  const [, operator, operandStr] = match;
  const operand = parseFloat(operandStr ?? '0');

  switch (operator) {
    case '+': return Math.floor(value + operand);
    case '-': return Math.floor(value - operand);
    case '*': return Math.floor(value * operand);
    case '/': return operand !== 0 ? Math.floor(value / operand) : fallback;
    default: return fallback;
  }
}

export interface SkillPools {
  basePool: number;
  occPool: number;
  hobbyPool: number;
  totalPool: number;
}

/**
 * Compute the 3 pool sizes from the character's current stats and the creation config.
 */
export function computeSkillPools(stats: WizardStats, config?: CharacterCreationConfig | null): SkillPools {
  const basePool = config?.skills.totalPoints ?? 250;
  const occPool = Math.max(0, evalStatFormula(config?.skills.occupationPointsFormula ?? 'EDUx4', 'EDU', stats.education));
  const hobbyPool = Math.max(0, evalStatFormula(config?.skills.hobbyPointsFormula ?? 'INTx2', 'INT', stats.intelligence));

  return { basePool, occPool, hobbyPool, totalPool: basePool + occPool + hobbyPool };
}

export interface SkillPoolUsage {
  /** Punti attribuiti al pool Professione (EDU x N) - solo l'eccedenza oltre il base pool */
  spentOcc: number;
  /** Punti attribuiti al pool Hobby (INT x N) - solo l'eccedenza oltre il base pool */
  spentHobby: number;
  /** Eccedenza oltre la capienza del pool Professione (spesa infeasible) */
  overflowOcc: number;
  /** Eccedenza oltre la capienza del pool Hobby (spesa infeasible) */
  overflowHobby: number;
  totalSpent: number;
  /** Portion of the base pool actually in use */
  baseUsed: number;
  isFeasible: boolean;
}

/**
 * Is this skill "professione" (EDU x N pool) or "hobby" (INT x N pool)? Single
 * source of truth for the classification - skills are already marked via
 * occupation.occupationSkillIds / requiredPlaceholderSkills, so this is a
 * straight lookup, no cleverness needed.
 */
export function isOccupationSkill(
  skillId: string,
  dynamicSkills: DynamicSkill[],
  occupation: WizardOccupation
): boolean {
  const dynamicEntry = dynamicSkills.find((ds) => ds.skillId === skillId);
  if (dynamicEntry) {
    return (occupation.requiredPlaceholderSkills || []).includes(dynamicEntry.name);
  }
  return (occupation.occupationSkillIds || []).includes(skillId);
}

/**
 * Sum current manualPoints+requiredBonus spend, split by type. Pure sum, no
 * ordering - "how much of that came from base" is a separate question,
 * answered by the incrementally-tracked baseClaimedByOcc/baseClaimedByHobby.
 */
export function sumSkillSpend(
  skills: Record<string, SkillBreakdown>,
  dynamicSkills: DynamicSkill[],
  occupation: WizardOccupation,
  override?: { skillId: string; manualPoints: number }
): { spentOccRaw: number; spentHobbyRaw: number } {
  let spentOccRaw = 0;
  let spentHobbyRaw = 0;

  for (const [skillId, breakdown] of Object.entries(skills)) {
    const manualPoints = skillId === override?.skillId ? override.manualPoints : breakdown.manualPoints;
    const pointsSpent = manualPoints + breakdown.requiredBonus;
    if (pointsSpent <= 0) continue;

    if (isOccupationSkill(skillId, dynamicSkills, occupation)) {
      spentOccRaw += pointsSpent;
    } else {
      spentHobbyRaw += pointsSpent;
    }
  }

  return { spentOccRaw, spentHobbyRaw };
}

/**
 * Classify current skill-point spend into the base/occupation/hobby pools and
 * check feasibility. `override` lets a caller check a hypothetical single-skill
 * change before committing it (e.g. Step4Skills' handleTotalChange), without
 * mutating the real `skills` map.
 *
 * `baseClaimedByOcc`/`baseClaimedByHobby` come from the wizard store, tracked
 * incrementally as points actually change (see updateSkill) - this function
 * just subtracts that already-known claim from the raw type totals.
 */
export function computeSkillPoolUsage(
  skills: Record<string, SkillBreakdown>,
  dynamicSkills: DynamicSkill[],
  occupation: WizardOccupation,
  pools: SkillPools,
  baseClaimedByOcc: number,
  baseClaimedByHobby: number,
  override?: { skillId: string; manualPoints: number }
): SkillPoolUsage {
  const { spentOccRaw, spentHobbyRaw } = sumSkillSpend(skills, dynamicSkills, occupation, override);

  const spentOcc = Math.max(0, spentOccRaw - baseClaimedByOcc);
  const spentHobby = Math.max(0, spentHobbyRaw - baseClaimedByHobby);
  const baseUsed = baseClaimedByOcc + baseClaimedByHobby;

  const overflowOcc = Math.max(0, spentOcc - pools.occPool);
  const overflowHobby = Math.max(0, spentHobby - pools.hobbyPool);

  return {
    spentOcc,
    spentHobby,
    overflowOcc,
    overflowHobby,
    totalSpent: spentOccRaw + spentHobbyRaw,
    baseUsed,
    isFeasible: overflowOcc === 0 && overflowHobby === 0 && baseUsed <= pools.basePool,
  };
}

/**
 * One-time baseline split of the base pool between occ/hobby raw spend, used
 * when there's no incremental history to fall back on (autoAssignRequiredSkills
 * right after an occupation is (re)selected, or loading an existing draft).
 * Deterministic, no arbitrary type priority: whichever type is spending LESS
 * gets covered by base first (in full, if it fits), the other gets whatever's
 * left - this minimizes total overflow, the only "fair" tie-break that doesn't
 * favor one type over the other.
 */
export function computeInitialBaseClaims(
  spentOccRaw: number,
  spentHobbyRaw: number,
  basePool: number
): { baseClaimedByOcc: number; baseClaimedByHobby: number } {
  if (spentOccRaw <= spentHobbyRaw) {
    const baseClaimedByOcc = Math.min(spentOccRaw, basePool);
    const baseClaimedByHobby = Math.min(spentHobbyRaw, basePool - baseClaimedByOcc);
    return { baseClaimedByOcc, baseClaimedByHobby };
  }
  const baseClaimedByHobby = Math.min(spentHobbyRaw, basePool);
  const baseClaimedByOcc = Math.min(spentOccRaw, basePool - baseClaimedByHobby);
  return { baseClaimedByOcc, baseClaimedByHobby };
}
