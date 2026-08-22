/**
 * Skill Point Pools
 *
 * Three skill-point pools during character creation:
 * - Occupation pool (EDU x N): spendable ONLY on occupation-eligible skills.
 * - Hobby pool (INT x N): spendable ONLY on non-occupation skills.
 * - Base pool: flat, spendable on any skill regardless of type.
 *
 * Spend order: each skill draws FIRST from its own earmarked pool (EDU x N for
 * occupation skills, INT x N otherwise); only the excess beyond that pool's
 * capacity falls back on the flexible base pool. The build is feasible as long
 * as the two excesses together fit in the base pool.
 *
 * This is a pure function of the current `skills` snapshot: it does NOT depend
 * on the order in which points were assigned, so it survives a page refresh, a
 * draft reload, and a stats change identically. An earlier version drew from
 * base FIRST, which is order-dependent - it needed incremental
 * `baseClaimedByOcc`/`baseClaimedByHobby` counters in the wizard store that were
 * never persisted (so a refresh reset them to 0 and the toolbar showed garbage)
 * and it flagged perfectly feasible builds as over budget depending on the order
 * the player happened to click in. Don't reintroduce that: keep this stateless.
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
  // 200 = stesso fallback del backend (DEFAULT_BASE_SKILL_POINTS in
  // characterCreationUtils.ts). I due valori devono coincidere SEMPRE: se
  // divergono, il wizard mostra un budget diverso da quello che il server
  // valida e il submit viene rifiutato senza spiegazione.
  const basePool = config?.skills.totalPoints ?? 200;
  const occPool = Math.max(0, evalStatFormula(config?.skills.occupationPointsFormula ?? 'EDUx4', 'EDU', stats.education));
  const hobbyPool = Math.max(0, evalStatFormula(config?.skills.hobbyPointsFormula ?? 'INTx2', 'INT', stats.intelligence));

  return { basePool, occPool, hobbyPool, totalPool: basePool + occPool + hobbyPool };
}

export interface SkillPoolUsage {
  /** Spesa lorda sulle abilità di professione (manualPoints + requiredBonus) */
  spentOccRaw: number;
  /** Spesa lorda sulle abilità NON di professione */
  spentHobbyRaw: number;
  /** Quanta parte del pool Professione (EDU x N) è realmente consumata */
  spentOcc: number;
  /** Quanta parte del pool Hobby (INT x N) è realmente consumata */
  spentHobby: number;
  /** Eccedenza di professione scaricata sul pool base */
  baseFromOcc: number;
  /** Eccedenza di hobby scaricata sul pool base */
  baseFromHobby: number;
  /** Porzione del pool base in uso (baseFromOcc + baseFromHobby) */
  baseUsed: number;
  /** Quanto si sfora anche il pool base: > 0 = build non ammissibile */
  baseOverflow: number;
  totalSpent: number;
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
 * Sum current manualPoints+requiredBonus spend, split by type. Pure sum: which
 * pool each chunk lands in is decided by computeSkillPoolUsage.
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
 * Classify current skill-point spend into the occupation/hobby/base pools and
 * check feasibility. `override` lets a caller check a hypothetical single-skill
 * change before committing it, without mutating the real `skills` map.
 *
 * Earmarked pool first, base absorbs the excess - stateless, order-independent,
 * identical to the backend check. See the module doc for why.
 */
export function computeSkillPoolUsage(
  skills: Record<string, SkillBreakdown>,
  dynamicSkills: DynamicSkill[],
  occupation: WizardOccupation,
  pools: SkillPools,
  override?: { skillId: string; manualPoints: number }
): SkillPoolUsage {
  const { spentOccRaw, spentHobbyRaw } = sumSkillSpend(skills, dynamicSkills, occupation, override);

  const spentOcc = Math.min(spentOccRaw, pools.occPool);
  const spentHobby = Math.min(spentHobbyRaw, pools.hobbyPool);

  const baseFromOcc = spentOccRaw - spentOcc;
  const baseFromHobby = spentHobbyRaw - spentHobby;
  const baseUsed = baseFromOcc + baseFromHobby;
  const baseOverflow = Math.max(0, baseUsed - pools.basePool);

  return {
    spentOccRaw,
    spentHobbyRaw,
    spentOcc,
    spentHobby,
    baseFromOcc,
    baseFromHobby,
    baseUsed,
    baseOverflow,
    totalSpent: spentOccRaw + spentHobbyRaw,
    isFeasible: baseOverflow === 0,
  };
}
