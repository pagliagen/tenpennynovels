/**
 * Damage Calculator Utility (TiroContrapposto Phase 2)
 *
 * Handles dice-based damage calculation for combat.
 * Supports formulas like "1d6+2", "1d8+db", "2d4-1".
 *
 * @module game/utils/damageCalculator
 * @since 2.0.0 - TiroContrapposto Phase 2
 */

import { SuccessDegree } from './successDegrees';

/**
 * Damage Roll Result
 */
export interface DamageRollResult {
  total: number;
  rolls: number[];
  formula: string;
  damageBonus: number;
  isCritical: boolean;
}

/**
 * Parse Damage Bonus String
 *
 * Converts damage bonus string (e.g., "+1d4", "-1d6", "+2", "0") to numeric value.
 *
 * @param damageBonusStr - Damage bonus from character (e.g., "+1d4")
 * @returns Numeric damage bonus
 */
export function parseDamageBonus(damageBonusStr: string): number {
  if (!damageBonusStr || damageBonusStr === '0' || damageBonusStr === '+0') {
    return 0;
  }

  // Handle dice notation (e.g., "+1d4", "-1d6")
  const diceMatch = damageBonusStr.match(/([+-])?(\d+)d(\d+)/);
  if (diceMatch) {
    const sign = diceMatch[1] === '-' ? -1 : 1;
    const numDice = Number.parseInt(diceMatch[2], 10);
    const diceSize = Number.parseInt(diceMatch[3], 10);

    // Roll the dice
    let total = 0;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1;
    }

    return sign * total;
  }

  // Handle simple numeric bonus (e.g., "+2", "-1")
  const numericMatch = damageBonusStr.match(/([+-])?(\d+)/);
  if (numericMatch) {
    const sign = numericMatch[1] === '-' ? -1 : 1;
    const value = Number.parseInt(numericMatch[2], 10);
    return sign * value;
  }

  return 0;
}

/**
 * Roll Dice
 *
 * Rolls NdX dice (e.g., 1d6, 2d4).
 *
 * @param numDice - Number of dice to roll
 * @param diceSize - Size of each die (e.g., 6 for d6)
 * @returns Array of individual die rolls
 */
export function rollDice(numDice: number, diceSize: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * diceSize) + 1);
  }
  return rolls;
}

/**
 * Calculate Damage
 *
 * Rolls damage dice based on weapon formula and applies bonuses.
 * Supports formulas: "1d6", "1d8+2", "2d4-1", "1d6+db" (db = damage bonus).
 *
 * @param damageFormula - Weapon damage formula (e.g., "1d6+2")
 * @param characterDamageBonus - Character's damage bonus string (e.g., "+1d4")
 * @param attackSuccessLevel - Success level of attack roll (for criticals)
 * @returns Damage roll result
 *
 * @example
 * ```typescript
 * const result = calculateDamage("1d6+2", "+1d4", "extreme");
 * // result.total might be: 6 (base roll) + 2 (formula modifier) + 3 (damage bonus) = 11
 * // result.isCritical = true (extreme counts as critical)
 * ```
 */
export function calculateDamage(
  damageFormula: string,
  characterDamageBonus: string,
  attackSuccessLevel: SuccessDegree
): DamageRollResult {
  // Parse damage formula (e.g., "1d6+2", "1d8+db")
  const formulaMatch = damageFormula.match(/(\d+)d(\d+)([+-]\d+)?([+-]db)?/i);

  if (!formulaMatch) {
    throw new Error(`Invalid damage formula: ${damageFormula}`);
  }

  const numDice = Number.parseInt(formulaMatch[1], 10);
  const diceSize = Number.parseInt(formulaMatch[2], 10);
  const staticModifier = formulaMatch[3] ? Number.parseInt(formulaMatch[3], 10) : 0;
  const includesDamageBonus = !!formulaMatch[4];

  // Roll base damage
  const rolls = rollDice(numDice, diceSize);
  let total = rolls.reduce((sum, roll) => sum + roll, 0);

  // Apply static modifier from formula
  total += staticModifier;

  // Apply character damage bonus if formula includes "+db"
  let damageBonus = 0;
  if (includesDamageBonus) {
    damageBonus = parseDamageBonus(characterDamageBonus);
    total += damageBonus;
  }

  // Check if critical
  const isCritical = attackSuccessLevel === 'extreme' || attackSuccessLevel === 'critical';

  // Critical hits: maximum damage (CoC 7e rule)
  if (isCritical) {
    // Re-roll and add to total (impaling/crushing weapon rule)
    const criticalRolls = rollDice(numDice, diceSize);
    const criticalDamage = criticalRolls.reduce((sum, roll) => sum + roll, 0);
    total += criticalDamage;
  }

  // Minimum damage is 0
  total = Math.max(0, total);

  return {
    total,
    rolls,
    formula: damageFormula,
    damageBonus,
    isCritical
  };
}

/**
 * Apply Damage to Character
 *
 * Reduces character's current HP and updates combat state.
 * Handles incapacitation and death.
 *
 * @param currentHP - Character's current hit points
 * @param maxHP - Character's maximum hit points
 * @param damage - Damage amount to apply
 * @returns Updated combat state
 */
export function applyDamage(
  currentHP: number,
  maxHP: number,
  damage: number
): {
  newHP: number;
  isDead: boolean;
  isIncapacitated: boolean;
} {
  const newHP = Math.max(0, currentHP - damage);

  // Death rules (CoC 7e):
  // - 0 HP: Incapacitated (unconscious, dying)
  // - Negative HP ≥ maxHP: Dead
  const isDead = newHP === 0 && currentHP - damage <= -maxHP;
  const isIncapacitated = newHP === 0 && !isDead;

  return {
    newHP,
    isDead,
    isIncapacitated
  };
}
