import { SkillDefinition } from './types';

const SKILL_BUDGET_DEFAULT = 250;
const SKILL_CAP = 75;
const SKILL_CAP_WITH_OCCUPATION = 80;
const REQUIRED_SKILL_MINIMUM = 40;
const DEFAULT_OCCUPATION_BONUS = 30;

/**
 * Distributes skill points based on AI-suggested skill IDs + weights.
 * Rules:
 * - Total points must equal skillsBudget (default 250)
 * - Each skill capped at SKILL_CAP (75)
 * - Uses skill baseValue from the definition
 * - Returns a map of skillId → manualPoints added
 */
export function allocateSkills(
  skills: SkillDefinition[],
  prioritySkillIds: string[],
  budget: number = SKILL_BUDGET_DEFAULT
): Record<string, number> {
  if (skills.length === 0) return {};

  const result: Record<string, number> = {};
  const skillMap = new Map(skills.map(s => [s.id, s]));

  // Filter to valid skill IDs
  const valid = prioritySkillIds.filter(id => skillMap.has(id));

  // If fewer than 6 priority skills, add more from the full list
  const supplemental = skills
    .filter(s => !valid.includes(s.id) && !s.isPlaceholder)
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, 8 - valid.length))
    .map(s => s.id);

  const allTargetIds = [...valid, ...supplemental];

  // Weighted distribution: priority skills get more points
  const weights: Record<string, number> = {};
  allTargetIds.forEach((id, i) => {
    weights[id] = i < valid.length ? 3 : 1;
  });

  const totalWeight = allTargetIds.reduce((s, id) => s + weights[id], 0);
  let remaining = budget;

  for (const id of allTargetIds) {
    if (remaining <= 0) break;
    const skill = skillMap.get(id)!;
    const raw = Math.round((weights[id] / totalWeight) * budget);
    const maxCanAdd = Math.max(0, SKILL_CAP - skill.baseValue);
    const points = Math.min(raw, maxCanAdd, remaining);
    if (points > 0) {
      result[id] = points;
      remaining -= points;
    }
  }

  // Distribute remaining points to skills that have room
  if (remaining > 0) {
    for (const s of skills) {
      if (remaining <= 0) break;
      if (result[s.id] !== undefined) continue;
      const maxCanAdd = Math.max(0, SKILL_CAP - s.baseValue);
      const points = Math.min(remaining, maxCanAdd);
      if (points > 0) {
        result[s.id] = points;
        remaining -= points;
      }
    }
  }

  // CRITICAL: Normalize to EXACTLY match budget (like StatAllocator.normalizeSumTo)
  const normalized = normalizeSumTo(result, budget, skills);
  return normalized;
}

/**
 * Allocate skills with occupation bonuses
 *
 * CRITICAL RULES:
 * - Budget refers to POINTS SPENT (not absolute total)
 * - A skill NEVER has value < baseValue
 * - Points spent = total - baseValue
 * - Budget calculation: manualBudget = budget - requiredBonusTotal
 *
 * Example: Budget 250, baseValue 20, required 40 minimum
 *   → requiredBonus = 40 - 20 = 20 (points spent)
 *   → manualBudget = 250 - 20 = 230
 *   → total can never be < 20
 *
 * @param skills - Full skill definitions
 * @param prioritySkillIds - AI-suggested skills to prioritize
 * @param occupation - Selected occupation with requiredSkillSlots and bonusSkills
 * @param budget - Total skill points budget (250 default) for manual + required allocation
 * @returns Complete skill allocations with all bonuses
 */
export function allocateSkillsWithOccupation(
  skills: SkillDefinition[],
  prioritySkillIds: string[],
  occupation: any,
  budget: number = SKILL_BUDGET_DEFAULT
): Record<string, { base: number; requiredBonus: number; manualPoints: number; occupationBonus: number; total: number; category: string }> {
  // STEP 1: Calculate required bonuses first
  const requiredBonuses: Record<string, number> = {};
  let totalRequiredBonus = 0;

  if (occupation?.requiredSkillSlots && Array.isArray(occupation.requiredSkillSlots)) {
    for (const slot of occupation.requiredSkillSlots) {
      const options = slot.options || [];

      // Only auto-assign if exactly one option
      if (options.length === 1) {
        const option = options[0];
        const skillDef = skills.find(s => s.id === option.skillId || s.id === option.id);

        if (skillDef && !skillDef.isPlaceholder) {
          const requiredBonus = Math.max(0, REQUIRED_SKILL_MINIMUM - skillDef.baseValue);
          if (requiredBonus > 0) {
            requiredBonuses[skillDef.id] = requiredBonus;
            totalRequiredBonus += requiredBonus;
          }
        }
      }
    }
  }

  // STEP 2: Allocate remaining budget as manualPoints (budget - requiredBonus)
  const manualBudget = Math.max(0, budget - totalRequiredBonus);
  const manualPoints = allocateSkills(skills, prioritySkillIds, manualBudget);

  // STEP 3: Build result with all components
  const result: Record<string, any> = {};

  for (const skill of skills) {
    const manual = manualPoints[skill.id] || 0;
    const required = requiredBonuses[skill.id] || 0;

    result[skill.id] = {
      base: skill.baseValue,
      requiredBonus: required,
      manualPoints: manual,
      occupationBonus: 0,
      total: skill.baseValue + required + manual,
      category: skill.category
    };
  }

  // STEP 4: Apply bonus skills
  if (occupation?.bonusSkills && Array.isArray(occupation.bonusSkills)) {
    for (const bonusSkill of occupation.bonusSkills) {
      const skillDef = skills.find(s => s.id === bonusSkill.skillId || s.name?.toLowerCase() === bonusSkill.name?.toLowerCase());

      if (skillDef && result[skillDef.id]) {
        const currentSkill = result[skillDef.id];
        const bonusValue = bonusSkill.bonusValue || DEFAULT_OCCUPATION_BONUS;

        currentSkill.occupationBonus = bonusValue;
        currentSkill.total = skillDef.baseValue + currentSkill.requiredBonus + currentSkill.manualPoints + bonusValue;

        // Enforce cap (80 with occupation bonus)
        const cap = SKILL_CAP_WITH_OCCUPATION;
        if (currentSkill.total > cap) {
          const excess = currentSkill.total - cap;
          currentSkill.manualPoints = Math.max(0, currentSkill.manualPoints - excess);
          currentSkill.total = cap;
        }
      }
    }
  }

  return result;
}

/**
 * Apply occupation bonuses to skill allocations
 * - Auto-assigns required skills with requiredBonus
 * - Applies occupation bonus skills
 * - Enforces cap of 80 when occupationBonus > 0
 *
 * @param manualPoints - Result from allocateSkills (skillId → manualPoints)
 * @param skills - Full skill definitions
 * @param occupation - Selected occupation with requiredSkillSlots and bonusSkills
 * @returns Skill allocations with bonuses applied
 */
export function applyOccupationBonuses(
  manualPoints: Record<string, number>,
  skills: SkillDefinition[],
  occupation: any
): Record<string, { base: number; requiredBonus: number; manualPoints: number; occupationBonus: number; total: number; category: string }> {
  const skillMap = new Map(skills.map(s => [s.id, s]));
  const result: Record<string, any> = {};

  // Initialize all skills with base allocations
  for (const skill of skills) {
    const manual = manualPoints[skill.id] || 0;
    result[skill.id] = {
      base: skill.baseValue,
      requiredBonus: 0,
      manualPoints: manual,
      occupationBonus: 0,
      total: skill.baseValue + manual,
      category: skill.category
    };
  }

  if (!occupation) {
    return result;
  }

  // STEP 1: Auto-assign required skills
  if (occupation.requiredSkillSlots && Array.isArray(occupation.requiredSkillSlots)) {
    for (const slot of occupation.requiredSkillSlots) {
      const options = slot.options || [];

      // Only auto-assign if exactly one option
      if (options.length === 1) {
        const option = options[0];
        const skillDef = skills.find(s => s.id === option.skillId || s.id === option.id);

        if (skillDef && !skillDef.isPlaceholder) {
          const currentSkill = result[skillDef.id];
          const requiredBonus = Math.max(0, REQUIRED_SKILL_MINIMUM - skillDef.baseValue);

          if (requiredBonus > 0) {
            currentSkill.requiredBonus = requiredBonus;
            currentSkill.total = skillDef.baseValue + requiredBonus + currentSkill.manualPoints + currentSkill.occupationBonus;
          }
        }
      }
    }
  }

  // STEP 2: Apply bonus skills
  if (occupation.bonusSkills && Array.isArray(occupation.bonusSkills)) {
    for (const bonusSkill of occupation.bonusSkills) {
      const skillDef = skills.find(s => s.id === bonusSkill.skillId || s.name?.toLowerCase() === bonusSkill.name?.toLowerCase());

      if (skillDef) {
        const currentSkill = result[skillDef.id];
        const bonusValue = bonusSkill.bonusValue || DEFAULT_OCCUPATION_BONUS;

        currentSkill.occupationBonus = bonusValue;
        currentSkill.total = skillDef.baseValue + currentSkill.requiredBonus + currentSkill.manualPoints + bonusValue;

        // Enforce cap (80 with occupation bonus)
        const cap = SKILL_CAP_WITH_OCCUPATION;
        if (currentSkill.total > cap) {
          const excess = currentSkill.total - cap;
          currentSkill.manualPoints = Math.max(0, currentSkill.manualPoints - excess);
          currentSkill.total = cap;
        }
      }
    }
  }

  return result;
}

/**
 * Normalize skill allocations to EXACTLY match target budget
 * Similar to StatAllocator.normalizeSumTo() but for skills
 * CRITICAL: Ensures exact budget compliance
 */
function normalizeSumTo(
  allocation: Record<string, number>,
  targetBudget: number,
  skillDefinitions: SkillDefinition[]
): Record<string, number> {
  const skillMap = new Map(skillDefinitions.map(s => [s.id, s]));
  const result = { ...allocation };

  // Calculate current total
  let currentTotal = Object.values(result).reduce((a, b) => a + b, 0);
  const diff = targetBudget - currentTotal;

  if (diff === 0) return result;

  if (diff > 0) {
    // Need to add points
    const skillIds = Object.keys(result).sort();
    let remaining = diff;

    for (const id of skillIds) {
      if (remaining <= 0) break;
      const skill = skillMap.get(id)!;
      const maxCanAdd = Math.max(0, SKILL_CAP - skill.baseValue - result[id]);
      const toAdd = Math.min(remaining, maxCanAdd);
      result[id] += toAdd;
      remaining -= toAdd;
    }

    // If still have remaining, add to new skills
    if (remaining > 0) {
      for (const skill of skillDefinitions) {
        if (remaining <= 0) break;
        if (result[skill.id] === undefined) {
          const maxCanAdd = Math.max(0, SKILL_CAP - skill.baseValue);
          const toAdd = Math.min(remaining, maxCanAdd);
          result[skill.id] = toAdd;
          remaining -= toAdd;
        }
      }
    }
  } else {
    // Need to subtract points
    let remaining = -diff;
    const skillIds = Object.keys(result).sort().reverse(); // Subtract from highest first

    for (const id of skillIds) {
      if (remaining <= 0) break;
      const toRemove = Math.min(result[id], remaining);
      result[id] -= toRemove;
      remaining -= toRemove;

      if (result[id] === 0) delete result[id];
    }
  }

  return result;
}
