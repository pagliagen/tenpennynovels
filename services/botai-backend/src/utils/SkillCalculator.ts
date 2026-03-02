/**
 * Skill Calculator Utility
 * Handles all skill-related calculations for bot character generation
 */

import { CharacterStats, SkillBreakdown, Skill, SkillBudget } from '../types/CompleteCharacter';

export class SkillCalculator {
  /**
   * Calculate base value for a skill
   * Handles three formats:
   * - Number: direct value (e.g., 20)
   * - "VALUE:XX": fixed value (e.g., "VALUE:20")
   * - "FORMULA:CHAR": formula based on character stats (e.g., "FORMULA:DEX*2")
   */
  static calculateBaseValue(skillBaseValue: string | number, stats: CharacterStats): number {
    // Direct number
    if (typeof skillBaseValue === 'number') {
      return skillBaseValue;
    }

    // VALUE:XX format
    if (skillBaseValue.startsWith('VALUE:')) {
      const value = parseInt(skillBaseValue.replace('VALUE:', ''), 10);
      return isNaN(value) ? 0 : value;
    }

    // FORMULA:CHAR format (e.g., "FORMULA:DEX*2", "FORMULA:STR+SIZ")
    if (skillBaseValue.startsWith('FORMULA:')) {
      const formula = skillBaseValue.replace('FORMULA:', '');
      return this.evaluateFormula(formula, stats);
    }

    // Fallback to 0 if unrecognized format
    return 0;
  }

  /**
   * Evaluate a formula string with character stats
   * Supports basic arithmetic: +, -, *, /
   * Example formulas: "DEX*2", "STR+SIZ", "(STR+CON)/2"
   */
  private static evaluateFormula(formula: string, stats: CharacterStats): number {
    try {
      // Replace stat names with actual values
      let evaluatedFormula = formula
        .replace(/STR/g, stats.strength.toString())
        .replace(/CON/g, stats.constitution.toString())
        .replace(/SIZ/g, stats.size.toString())
        .replace(/DEX/g, stats.dexterity.toString())
        .replace(/CHA/g, stats.charm.toString())
        .replace(/INT/g, stats.intelligence.toString())
        .replace(/POW/g, stats.power.toString())
        .replace(/EDU/g, stats.education.toString());

      // Evaluate the mathematical expression
      // eslint-disable-next-line no-eval
      const result = eval(evaluatedFormula);
      return Math.floor(result); // Round down to integer
    } catch (error) {
      console.error(`Failed to evaluate formula: ${formula}`, error);
      return 0;
    }
  }

  /**
   * Initialize a skill breakdown with base value only
   */
  static initializeSkillBreakdown(skill: Skill, stats: CharacterStats): SkillBreakdown {
    const base = this.calculateBaseValue(skill.baseValue, stats);

    return {
      total: base,
      base,
      requiredBonus: 0,
      manualPoints: 0,
      occupationBonus: 0,
      category: skill.category
    };
  }

  /**
   * Apply required skill bonus
   * Required skills get (40 - base) bonus to reach minimum 40
   */
  static applyRequiredBonus(breakdown: SkillBreakdown): SkillBreakdown {
    const requiredBonus = Math.max(0, 40 - breakdown.base);

    return {
      ...breakdown,
      requiredBonus,
      total: breakdown.base + requiredBonus + breakdown.manualPoints + breakdown.occupationBonus
    };
  }

  /**
   * Apply occupation bonus skill
   * Bonus skills get +30 points
   */
  static applyOccupationBonus(breakdown: SkillBreakdown): SkillBreakdown {
    const occupationBonus = 30;

    return {
      ...breakdown,
      occupationBonus,
      total: breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + occupationBonus
    };
  }

  /**
   * Add manual points to a skill
   * These count toward the skill budget
   */
  static addManualPoints(breakdown: SkillBreakdown, points: number): SkillBreakdown {
    const manualPoints = breakdown.manualPoints + points;

    return {
      ...breakdown,
      manualPoints,
      total: breakdown.base + breakdown.requiredBonus + manualPoints + breakdown.occupationBonus
    };
  }

  /**
   * Calculate skill budget based on intelligence
   * INT * 2 + 100 base points
   */
  static calculateSkillBudget(intelligence: number): SkillBudget {
    const intPoints = intelligence * 2;
    const basePoints = 100;
    const total = intPoints + basePoints;

    return {
      intPoints,
      basePoints,
      total,
      used: 0,
      remaining: total
    };
  }

  /**
   * Update budget after spending points
   */
  static updateBudget(budget: SkillBudget, pointsSpent: number): SkillBudget {
    const used = budget.used + pointsSpent;
    const remaining = budget.total - used;

    return {
      ...budget,
      used,
      remaining
    };
  }

  /**
   * Validate that budget is not exceeded
   */
  static validateBudget(budget: SkillBudget): boolean {
    return budget.used <= budget.total && budget.remaining >= 0;
  }

  /**
   * Compute total skill value
   */
  static computeTotal(breakdown: SkillBreakdown): number {
    return breakdown.base + breakdown.requiredBonus + breakdown.manualPoints + breakdown.occupationBonus;
  }

  /**
   * Get total manual points used across all skills
   */
  static getTotalManualPoints(skillsMap: Record<string, SkillBreakdown>): number {
    return Object.values(skillsMap).reduce((total, skill) => total + skill.manualPoints, 0);
  }

  /**
   * Validate that all required skills meet minimum threshold
   */
  static validateRequiredSkills(
    skillsMap: Record<string, SkillBreakdown>,
    requiredSkills: string[]
  ): boolean {
    return requiredSkills.every(skillName => {
      const skill = skillsMap[skillName];
      return skill && skill.total >= 40;
    });
  }

  /**
   * Distribute points to a list of prioritized skills
   * Returns updated skills map and remaining budget
   */
  static distributePoints(
    skillsMap: Record<string, SkillBreakdown>,
    priorities: Array<{ skillName: string; points: number }>,
    budget: SkillBudget
  ): { skillsMap: Record<string, SkillBreakdown>; budget: SkillBudget } {
    let updatedSkills = { ...skillsMap };
    let updatedBudget = { ...budget };

    for (const priority of priorities) {
      const { skillName, points } = priority;

      // Check if skill exists and we have budget
      if (!updatedSkills[skillName] || updatedBudget.remaining < points) {
        continue;
      }

      // Add points to skill
      const currentBreakdown = updatedSkills[skillName];
      const newBreakdown = this.addManualPoints(currentBreakdown, points);
      updatedSkills[skillName] = newBreakdown;

      // Update budget
      updatedBudget = this.updateBudget(updatedBudget, points);
    }

    return { skillsMap: updatedSkills, budget: updatedBudget };
  }

  /**
   * Cap a skill at maximum value (usually 90 for most skills)
   */
  static capSkillValue(breakdown: SkillBreakdown, maxValue: number = 90): SkillBreakdown {
    if (breakdown.total <= maxValue) {
      return breakdown;
    }

    // Reduce manual points to cap at max value
    const excess = breakdown.total - maxValue;
    const newManualPoints = Math.max(0, breakdown.manualPoints - excess);

    return {
      ...breakdown,
      manualPoints: newManualPoints,
      total: breakdown.base + breakdown.requiredBonus + newManualPoints + breakdown.occupationBonus
    };
  }

  /**
   * Get skills by category
   */
  static getSkillsByCategory(
    skillsMap: Record<string, SkillBreakdown>,
    category: string
  ): Record<string, SkillBreakdown> {
    const filtered: Record<string, SkillBreakdown> = {};

    for (const [skillName, breakdown] of Object.entries(skillsMap)) {
      if (breakdown.category === category) {
        filtered[skillName] = breakdown;
      }
    }

    return filtered;
  }

  /**
   * Get skills above a threshold
   */
  static getSkillsAboveThreshold(
    skillsMap: Record<string, SkillBreakdown>,
    threshold: number
  ): Record<string, SkillBreakdown> {
    const filtered: Record<string, SkillBreakdown> = {};

    for (const [skillName, breakdown] of Object.entries(skillsMap)) {
      if (breakdown.total >= threshold) {
        filtered[skillName] = breakdown;
      }
    }

    return filtered;
  }
}
