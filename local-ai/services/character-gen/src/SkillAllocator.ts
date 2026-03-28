import { SkillDefinition } from './types';

const SKILL_BUDGET_DEFAULT = 250;
const SKILL_CAP = 75;

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

  return result;
}
