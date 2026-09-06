/**
 * Dice Service
 *
 * Centralized dice rolling service for all chat actions.
 * Eliminates duplication of rollDice() logic (used 6+ times in ChatController).
 *
 * @module services/DiceService
 * @since 2.1.0
 */

import { logger } from '../logger';

/**
 * Parsed dice specification
 */
export interface ParsedDiceSpec {
  count: number;
  type: number;
  modifier: number;
  isValid: boolean;
}

/**
 * Dice roll result
 */
export interface DiceRollResult {
  dice: string;
  result: number;
  rolls?: number[];
  modifier?: number;
  total: number;
}

/**
 * Dice Service
 */
export class DiceService {
  /**
   * Parse dice specification string
   * Format: {count}d{type}[+/-modifier]
   *
   * Examples:
   * - "2d6+3" → count: 2, type: 6, modifier: 3
   * - "1d20" → count: 1, type: 20, modifier: 0
   * - "3d8-2" → count: 3, type: 8, modifier: -2
   * - "1d100" → count: 1, type: 100, modifier: 0
   *
   * @param diceSpec - Dice specification string
   * @returns Parsed dice spec with validation flag
   */
  parseDiceSpec(diceSpec: string): ParsedDiceSpec {
    // Default to 1d100
    const normalized = diceSpec.trim() || '1d100';

    const regex = /^(\d+)d(\d+)([+-]\d+)?$/i;
    const match = normalized.match(regex);

    if (!match) {
      return { count: 1, type: 100, modifier: 0, isValid: false };
    }

    const count = Number.parseInt(match[1], 10);
    const type = Number.parseInt(match[2], 10);
    const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;

    const validTypes = [4, 6, 8, 10, 12, 20, 100];
    const isValid =
      count >= 1 && count <= 20 &&
      validTypes.includes(type) &&
      modifier >= -99 && modifier <= 99;

    return { count, type, modifier, isValid };
  }

  /**
   * Roll dice with multi-dice support
   *
   * @param diceSpec - Dice specification (e.g., "2d6+3", "1d20", "1d100")
   * @returns Roll result with individual rolls and total
   */
  rollDice(diceSpec?: string): DiceRollResult {
    const spec = diceSpec || '1d100';
    const parsed = this.parseDiceSpec(spec);

    if (!parsed.isValid) {
      logger.warn(`[DiceService] Invalid dice spec: ${spec}, falling back to 1d100`);
      const result = Math.floor(Math.random() * 100) + 1;
      return { dice: '1d100', result, total: result };
    }

    const { count, type, modifier } = parsed;

    // Roll each die
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * type) + 1);
    }

    const result = rolls.reduce((sum, roll) => sum + roll, 0);
    const total = result + modifier;

    return {
      dice: spec,
      result,
      rolls: count > 1 ? rolls : undefined,
      modifier: modifier !== 0 ? modifier : undefined,
      total
    };
  }

  /**
   * Roll 1d100 (most common case - optimization)
   * @returns Roll result (1-100)
   */
  rollD100(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
