/**
 * Skill Point Pools
 *
 * Three skill-point pools during character creation:
 * - Base pool: flat, spendable on any skill (unchanged from before this module existed).
 * - Occupation pool (EDU x N): spendable ONLY on occupation-eligible skills.
 * - Hobby pool (INT x N): spendable ONLY on non-occupation skills.
 *
 * The base pool covers whatever overflows the two earmarked pools, but not beyond
 * its own size. Mirrors the server-side authoritative check in
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
  spentOcc: number;
  spentHobby: number;
  overflowOcc: number;
  overflowHobby: number;
  totalSpent: number;
  /** Portion of the base pool actually in use (= overflowOcc + overflowHobby) */
  baseUsed: number;
  isFeasible: boolean;
}

/**
 * Classify current skill-point spend into the occupation/hobby pools and check
 * feasibility against the 3 pool sizes. `override` lets a caller check a
 * hypothetical single-skill change before committing it (e.g. Step4Skills'
 * handleTotalChange), without mutating the real `skills` map.
 */
export function computeSkillPoolUsage(
  skills: Record<string, SkillBreakdown>,
  dynamicSkills: DynamicSkill[],
  occupation: WizardOccupation,
  pools: SkillPools,
  override?: { skillId: string; manualPoints: number }
): SkillPoolUsage {
  const occupationSkillIds = new Set(occupation.occupationSkillIds || []);
  const occupationPlaceholderNames = new Set(occupation.requiredPlaceholderSkills || []);
  const dynamicSkillById = new Map(dynamicSkills.map((ds) => [ds.skillId, ds]));

  let spentOcc = 0;
  let spentHobby = 0;

  for (const [skillId, breakdown] of Object.entries(skills)) {
    const manualPoints = skillId === override?.skillId ? override.manualPoints : breakdown.manualPoints;
    const pointsSpent = manualPoints + breakdown.requiredBonus;
    if (pointsSpent === 0) continue;

    const dynamicEntry = dynamicSkillById.get(skillId);
    const isOccupation = dynamicEntry
      ? occupationPlaceholderNames.has(dynamicEntry.name)
      : occupationSkillIds.has(skillId);

    if (isOccupation) {
      spentOcc += pointsSpent;
    } else {
      spentHobby += pointsSpent;
    }
  }

  const overflowOcc = Math.max(0, spentOcc - pools.occPool);
  const overflowHobby = Math.max(0, spentHobby - pools.hobbyPool);
  const totalSpent = spentOcc + spentHobby;
  const baseUsed = overflowOcc + overflowHobby;

  return {
    spentOcc,
    spentHobby,
    overflowOcc,
    overflowHobby,
    totalSpent,
    baseUsed,
    isFeasible: baseUsed <= pools.basePool && totalSpent <= pools.totalPool,
  };
}
