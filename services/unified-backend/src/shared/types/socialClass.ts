/**
 * Social Class Type System
 *
 * TenpennyNovels uses a granular 8-level social class system based on the
 * Call of Cthulhu Credit Rating skill (FINANZA, 1-99).
 *
 * This provides precise economic modeling while maintaining role-playing authenticity
 * for Victorian London setting.
 */

// ============================================================================
// CORE TYPE DEFINITIONS
// ============================================================================

/**
 * Granular social class type (8 values)
 * Used everywhere in the application for consistency
 */
export type SocialClass =
  | 'destitute'      // Indigente: FINANZA 1-9
  | 'poor'           // Povero: FINANZA 10-19
  | 'modest'         // Modesto: FINANZA 20-39
  | 'lower_middle'   // Piccola borghesia: FINANZA 40-49
  | 'middle_class'   // Media borghesia: FINANZA 50-69
  | 'wealthy'        // Ricco: FINANZA 70-79
  | 'affluent'       // Facoltoso: FINANZA 80-89
  | 'elite';         // Élite: FINANZA 90-99

/**
 * Display modifier (not a separate social class)
 * Aristocracy is a badge for elite characters with nobility occupation/background
 */
export type DisplayModifier = 'aristocracy';

/**
 * Social class with full information
 */
export interface SocialClassInfo {
  id: SocialClass;
  label: string; // Italian display name
  financeRange: { min: number; max: number };
  weeklyCredit: number;
  initialWealth: { min: number; max: number };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Italian labels for display
 */
export const SOCIAL_CLASS_LABELS: Record<SocialClass, string> = {
  'destitute': 'Indigente',
  'poor': 'Povero',
  'modest': 'Modesto',
  'lower_middle': 'Piccola borghesia',
  'middle_class': 'Media borghesia',
  'wealthy': 'Ricco',
  'affluent': 'Facoltoso',
  'elite': 'Élite'
};

/**
 * All social classes as array (for validation, UI dropdowns, iteration)
 */
export const ALL_SOCIAL_CLASSES: SocialClass[] = [
  'destitute',
  'poor',
  'modest',
  'lower_middle',
  'middle_class',
  'wealthy',
  'affluent',
  'elite'
];

/**
 * FINANZA skill ranges for each social class
 */
const FINANZA_RANGES: Record<SocialClass, { min: number; max: number }> = {
  'destitute': { min: 1, max: 9 },
  'poor': { min: 10, max: 19 },
  'modest': { min: 20, max: 39 },
  'lower_middle': { min: 40, max: 49 },
  'middle_class': { min: 50, max: 69 },
  'wealthy': { min: 70, max: 79 },
  'affluent': { min: 80, max: 89 },
  'elite': { min: 90, max: 99 }
};

/**
 * Weekly credit amounts (in pounds) for each social class
 * Based on character-creation.json configuration
 */
const WEEKLY_CREDIT: Record<SocialClass, number> = {
  'destitute': 2,
  'poor': 5,
  'modest': 15,
  'lower_middle': 30,
  'middle_class': 75,
  'wealthy': 150,
  'affluent': 300,
  'elite': 500
};

/**
 * Initial wealth ranges (in pounds) for each social class
 * Based on character-creation.json configuration
 */
const INITIAL_WEALTH: Record<SocialClass, { min: number; max: number }> = {
  'destitute': { min: 5, max: 15 },
  'poor': { min: 20, max: 40 },
  'modest': { min: 50, max: 100 },
  'lower_middle': { min: 150, max: 300 },
  'middle_class': { min: 400, max: 800 },
  'wealthy': { min: 1000, max: 2000 },
  'affluent': { min: 3000, max: 5000 },
  'elite': { min: 8000, max: 15000 }
};

// ============================================================================
// HELPER CLASS
// ============================================================================

/**
 * Utility class for social class operations
 */
export class SocialClassHelper {
  /**
   * Calculate social class from FINANZA skill value
   *
   * @param finanza - FINANZA (Credit Rating) skill value (1-99)
   * @returns The corresponding social class
   *
   * @example
   * SocialClassHelper.fromFinanza(5)   // 'destitute'
   * SocialClassHelper.fromFinanza(50)  // 'middle_class'
   * SocialClassHelper.fromFinanza(95)  // 'elite'
   */
  static fromFinanza(finanza: number): SocialClass {
    if (finanza <= 9) return 'destitute';
    if (finanza <= 19) return 'poor';
    if (finanza <= 39) return 'modest';
    if (finanza <= 49) return 'lower_middle';
    if (finanza <= 69) return 'middle_class';
    if (finanza <= 79) return 'wealthy';
    if (finanza <= 89) return 'affluent';
    return 'elite';
  }

  /**
   * Get Italian display label for a social class
   *
   * @param socialClass - The social class
   * @returns Italian label for display
   *
   * @example
   * SocialClassHelper.getLabel('poor')  // 'Povero'
   */
  static getLabel(socialClass: SocialClass): string {
    return SOCIAL_CLASS_LABELS[socialClass];
  }

  /**
   * Get full information about a social class
   *
   * @param socialClass - The social class
   * @returns Complete social class information
   */
  static getInfo(socialClass: SocialClass): SocialClassInfo {
    return {
      id: socialClass,
      label: SOCIAL_CLASS_LABELS[socialClass],
      financeRange: FINANZA_RANGES[socialClass],
      weeklyCredit: WEEKLY_CREDIT[socialClass],
      initialWealth: INITIAL_WEALTH[socialClass]
    };
  }

  /**
   * Check if a character qualifies for "aristocracy" display badge
   *
   * Aristocracy is not a separate social class, but a display modifier for
   * elite characters with nobility occupation or background.
   *
   * @param character - Character object with socialClass, occupation, and background
   * @returns true if character should display aristocracy badge
   *
   * @example
   * const char = {
   *   socialClass: 'elite',
   *   occupation: { category: 'nobility' }
   * };
   * SocialClassHelper.hasAristocracyBadge(char)  // true
   */
  static hasAristocracyBadge(character: {
    socialClass: SocialClass;
    occupation?: { category?: string };
    background?: { briefHistory?: string };
  }): boolean {
    // Must be elite to qualify for aristocracy
    if (character.socialClass !== 'elite') return false;

    // Check occupation category
    if (character.occupation?.category === 'nobility') return true;

    // Check background for nobility keywords
    const background = character.background?.briefHistory?.toLowerCase() || '';
    return background.includes('nobil') || background.includes('aristocra');
  }

  /**
   * Get color for UI display
   *
   * Returns a color code for visual representation of social class.
   * Uses a gradient from red (poorest) to cyan (richest).
   * Special purple color for aristocracy badge.
   *
   * @param socialClass - The social class
   * @param hasAristocracy - Whether to display aristocracy badge color
   * @returns Hex color code
   *
   * @example
   * SocialClassHelper.getColor('destitute')      // '#ef4444' (red)
   * SocialClassHelper.getColor('elite', true)    // '#8b5cf6' (purple)
   */
  static getColor(socialClass: SocialClass, hasAristocracy: boolean = false): string {
    if (hasAristocracy) return '#8b5cf6'; // Purple for aristocracy badge

    // Color gradient from red (poorest) to cyan (richest)
    const colors: Record<SocialClass, string> = {
      'destitute': '#ef4444',      // Red
      'poor': '#f97316',           // Orange-red
      'modest': '#f59e0b',         // Orange
      'lower_middle': '#eab308',   // Yellow
      'middle_class': '#84cc16',   // Yellow-green
      'wealthy': '#22c55e',        // Green
      'affluent': '#10b981',       // Teal
      'elite': '#06b6d4'           // Cyan
    };

    return colors[socialClass];
  }

  /**
   * Validate if a string is a valid social class
   *
   * @param value - String to validate
   * @returns true if value is a valid SocialClass
   */
  static isValid(value: string): value is SocialClass {
    return ALL_SOCIAL_CLASSES.includes(value as SocialClass);
  }

  /**
   * Get FINANZA range for a social class
   *
   * @param socialClass - The social class
   * @returns Min and max FINANZA values
   */
  static getFinanzaRange(socialClass: SocialClass): { min: number; max: number } {
    return FINANZA_RANGES[socialClass];
  }

  /**
   * Get weekly credit amount for a social class
   *
   * @param socialClass - The social class
   * @returns Weekly credit in pounds
   */
  static getWeeklyCredit(socialClass: SocialClass): number {
    return WEEKLY_CREDIT[socialClass];
  }

  /**
   * Get initial wealth range for a social class
   *
   * @param socialClass - The social class
   * @returns Min and max initial cash
   */
  static getInitialWealth(socialClass: SocialClass): { min: number; max: number } {
    return INITIAL_WEALTH[socialClass];
  }
}
