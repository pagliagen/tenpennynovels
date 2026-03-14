/**
 * Character Creation Configuration Service
 *
 * Manages loading, saving, and validation of character creation configuration
 * from /config/character-creation.json file.
 *
 * Features:
 * - Singleton pattern for global access
 * - In-memory caching with TTL (1 minute)
 * - Atomic file writes with automatic backup
 * - Validation of configuration structure and constraints
 * - Helper methods for calculations (skill points, social class, damage bonus)
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger({ serviceName: 'CharacterCreationConfigService' });

// ==================== INTERFACES ====================

export interface CharacterCreationConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
    lastModifiedBy: string;
  };
  stats: {
    basePoints: number;
    totalPoints: number;
    maxStatsAbove80: number;
    creationCap: number;    // Cap during wizard (DRAFT)
    gameplayCap: number;    // Cap during gameplay (APPROVED) - >= creationCap
    minValues: Record<string, number>;
    description: string;
  };
  skills: {
    totalPointsFormula: string; // "constant:200" or "formula:EDUx4" (use 'x' for multiplication)
    intelligenceBonusFormula: string;  // "INT/2", "INTx2", "INT+10", "constant:N"
    creationCap: number;                // Normal creation cap
    creationCapWithOccupation: number;  // Cap with occupation bonus
    gameplayCap: number;                // Gameplay cap - >= creationCap
    physicalSkillsExcludeIntBonus: boolean;
    description: string;
  };
  occupation: {
    requiredSkillMinimum: number;
    bonusSkillPoints: number;
    requiredSkillCount: { min: number; max: number };
    bonusSkillCount: { min: number; max: number };
    description: string;
  };
  limits: {
    age: { min: number; max: number };
    weight: { min: number; max: number; unit: string };
    height: { min: number; max: number; unit: string };
    backgroundFields: {
      briefHistoryMin: number;
      personalityMin: number;
      goalsMin: number;
      maxLength: number;
    };
  };
  socialClasses: Array<{
    id: string;
    name: string;
    financeSkillRange: { min: number; max: number };
    weeklyCredit: number;
    initialWealth: { minCash: number; maxCash: number };
  }>;
  formulas: {
    derived: Record<string, string>;
    damageBonus: Array<{ maxTotal: number; bonus: string; build: number }>;
  };
}

// ==================== SERVICE CLASS ====================

export class CharacterCreationConfigService {
  private static instance: CharacterCreationConfigService;
  private configPath: string;
  private cachedConfig: CharacterCreationConfig | null = null;
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  private constructor() {
    // Path relative to project root
    this.configPath = path.join(process.cwd(), 'services/unified-backend/src/config/static/character-creation.json');
  }

  public static getInstance(): CharacterCreationConfigService {
    if (!CharacterCreationConfigService.instance) {
      CharacterCreationConfigService.instance = new CharacterCreationConfigService();
    }
    return CharacterCreationConfigService.instance;
  }

  /**
   * Load configuration from JSON file with caching
   */
  public async loadConfig(): Promise<CharacterCreationConfig> {
    const now = Date.now();

    // Return cached config if still fresh
    if (this.cachedConfig && (now - this.lastLoadTime) < this.CACHE_TTL) {
      logger.debug('Returning cached character creation config', {
        cacheAge: now - this.lastLoadTime,
        version: this.cachedConfig._meta.version
      });
      return this.cachedConfig;
    }

    try {
      logger.debug('Loading character creation config from file', {
        path: this.configPath
      });

      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(fileContent);

      // Validate required fields
      this.validateConfig(config);

      this.cachedConfig = config;
      this.lastLoadTime = now;

      logger.info('Character creation config loaded successfully', {
        version: config._meta.version,
        lastUpdated: config._meta.lastUpdated,
        cacheExpiry: this.CACHE_TTL
      });

      return config;
    } catch (error: any) {
      logger.error('Failed to load character creation config', {
        error: error.message,
        stack: error.stack,
        path: this.configPath
      });

      // Fallback to defaults if file doesn't exist or is corrupted
      logger.warn('Using default character creation configuration');
      return this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to JSON file (atomic write with backup)
   */
  public async saveConfig(
    config: CharacterCreationConfig,
    modifiedBy: string
  ): Promise<void> {
    try {
      logger.info('Saving character creation config', {
        modifiedBy,
        version: config._meta.version
      });

      // Update metadata
      config._meta.lastUpdated = new Date().toISOString();
      config._meta.lastModifiedBy = modifiedBy;

      // Validate before saving
      this.validateConfig(config);

      // Create backup if file exists
      const backupPath = `${this.configPath}.backup`;
      try {
        await fs.access(this.configPath);
        await fs.copyFile(this.configPath, backupPath);
        logger.debug('Backup created', { backupPath });
      } catch (err) {
        // File doesn't exist yet, no backup needed
        logger.debug('No existing config to backup');
      }

      // Atomic write: write to temp file then rename
      const tempPath = `${this.configPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8');
      await fs.rename(tempPath, this.configPath);

      // Invalidate cache to force reload
      this.cachedConfig = config;
      this.lastLoadTime = Date.now();

      logger.info('Character creation config saved successfully', {
        version: config._meta.version,
        modifiedBy
      });

    } catch (error: any) {
      logger.error('Failed to save character creation config', {
        error: error.message,
        stack: error.stack,
        modifiedBy
      });
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Invalidate cache (forces reload on next access)
   */
  public invalidateCache(): void {
    this.cachedConfig = null;
    this.lastLoadTime = 0;
    logger.debug('Character creation config cache invalidated');
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate skill points based on formula
   * Supports both constant values and dynamic formulas
   */
  public calculateSkillPoints(
    intelligence: number,
    config: CharacterCreationConfig
  ): {
    base: number;
    intBonus: number;
    total: number;
  } {
    const formula = config.skills.totalPointsFormula;
    let basePoints = 200; // Default

    if (formula.startsWith('constant:')) {
      basePoints = parseInt(formula.replace('constant:', ''));
    } else if (formula.startsWith('formula:')) {
      // Handle formula-based calculation (e.g., "formula:EDUx4")
      // For future expansion - currently not implemented
      const formulaStr = formula.replace('formula:', '');
      logger.warn('Formula-based skill points not yet implemented', {
        formula: formulaStr
      });
      basePoints = 200;
    }

    const intBonus = calculateIntelligenceBonus(
      config.skills.intelligenceBonusFormula || 'INT/2',
      intelligence
    );

    return {
      base: basePoints,
      intBonus,
      total: basePoints + intBonus
    };
  }

  /**
   * Parse and calculate intelligence bonus from formula
   * Supports: INT/N, INTxN, INT+N, INT-N, constant:N
   * @param formula - Formula to calculate
   * @param intelligenceValue - Intelligence stat value
   * @returns Calculated INT bonus (floored)
   */
  public calculateIntelligenceBonusMethod(formula: string, intelligenceValue: number): number {
    return calculateIntelligenceBonus(formula, intelligenceValue);
  }

  /**
   * Validate intelligence bonus formula
   * @param formula - Formula to validate
   * @returns Validation result
   */
  public validateIntelligenceBonusFormulaMethod(formula: string): { valid: boolean; error?: string } {
    return validateIntelligenceBonusFormula(formula);
  }

  /**
   * Get social class by finance skill value
   */
  public getSocialClass(
    financeSkill: number,
    config: CharacterCreationConfig
  ): CharacterCreationConfig['socialClasses'][0] | null {
    const socialClass = config.socialClasses.find(
      sc => financeSkill >= sc.financeSkillRange.min &&
            financeSkill <= sc.financeSkillRange.max
    );

    if (!socialClass) {
      logger.warn('No social class found for finance skill', {
        financeSkill,
        availableRanges: config.socialClasses.map(sc => sc.financeSkillRange)
      });
      return config.socialClasses[0]; // Default to lowest class
    }

    return socialClass;
  }

  /**
   * Calculate damage bonus and build from strength + size
   */
  public calculateDamageBonus(
    strength: number,
    size: number,
    config: CharacterCreationConfig
  ): { damageBonus: string; build: number } {
    const total = strength + size;

    const entry = config.formulas.damageBonus.find(db => total <= db.maxTotal);

    if (!entry) {
      // Fallback to last entry (highest value)
      const lastEntry = config.formulas.damageBonus[config.formulas.damageBonus.length - 1];
      logger.warn('Damage bonus exceeds maximum total', {
        strength,
        size,
        total,
        usingFallback: lastEntry
      });
      return {
        damageBonus: lastEntry.bonus,
        build: lastEntry.build
      };
    }

    return {
      damageBonus: entry.bonus,
      build: entry.build
    };
  }

  // ==================== VALIDATION ====================

  /**
   * Validate configuration structure and business rules
   */
  private validateConfig(config: any): void {
    const errors: string[] = [];

    // Check required top-level fields
    const required = ['_meta', 'stats', 'skills', 'occupation', 'limits', 'socialClasses', 'formulas'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      errors.push(`Campi obbligatori mancanti: ${missing.join(', ')}`);
    }

    // Validate metadata
    if (config._meta) {
      if (!config._meta.version) errors.push('_meta.version is required');
      if (!config._meta.description) errors.push('_meta.description is required');
    }

    // Validate stats
    if (config.stats) {
      // CRITICAL: Ensure gameplayCap >= creationCap
      if (config.stats.gameplayCap < config.stats.creationCap) {
        errors.push(`stats.gameplayCap (${config.stats.gameplayCap}) must be >= creationCap (${config.stats.creationCap})`);
      }

      if (config.stats.totalPoints < 200 || config.stats.totalPoints > 600) {
        errors.push('stats.totalPoints must be between 200 and 600');
      }

      if (config.stats.creationCap < 70 || config.stats.creationCap > 99) {
        errors.push('stats.creationCap must be between 70 and 99');
      }

      if (config.stats.gameplayCap < 70 || config.stats.gameplayCap > 99) {
        errors.push('stats.gameplayCap must be between 70 and 99');
      }
    }

    // Validate skills
    if (config.skills) {
      // CRITICAL: Ensure gameplayCap >= creationCapWithOccupation >= creationCap
      if (config.skills.gameplayCap < config.skills.creationCapWithOccupation) {
        errors.push(`skills.gameplayCap (${config.skills.gameplayCap}) must be >= creationCapWithOccupation (${config.skills.creationCapWithOccupation})`);
      }

      if (config.skills.creationCapWithOccupation < config.skills.creationCap) {
        errors.push(`skills.creationCapWithOccupation (${config.skills.creationCapWithOccupation}) must be >= creationCap (${config.skills.creationCap})`);
      }

      // Validate skill points formula
      if (!config.skills.totalPointsFormula.startsWith('constant:') &&
          !config.skills.totalPointsFormula.startsWith('formula:')) {
        errors.push('skills.totalPointsFormula must start with "constant:" or "formula:"');
      }

      if (config.skills.creationCap < 50 || config.skills.creationCap > 90) {
        errors.push('skills.creationCap must be between 50 and 90');
      }
    }

    // Validate occupation
    if (config.occupation) {
      if (config.occupation.requiredSkillMinimum < 20 || config.occupation.requiredSkillMinimum > 60) {
        errors.push('occupation.requiredSkillMinimum must be between 20 and 60');
      }

      if (config.occupation.bonusSkillPoints < 10 || config.occupation.bonusSkillPoints > 50) {
        errors.push('occupation.bonusSkillPoints must be between 10 and 50');
      }
    }

    // Validate social classes
    if (config.socialClasses) {
      if (!Array.isArray(config.socialClasses) || config.socialClasses.length === 0) {
        errors.push('socialClasses must be a non-empty array');
      } else {
        // Check for gaps in finance skill ranges
        const sortedClasses = [...config.socialClasses].sort((a, b) =>
          a.financeSkillRange.min - b.financeSkillRange.min
        );

        for (let i = 1; i < sortedClasses.length; i++) {
          const prevMax = sortedClasses[i - 1].financeSkillRange.max;
          const currentMin = sortedClasses[i].financeSkillRange.min;

          if (currentMin !== prevMax + 1) {
            errors.push(`Gap in finance skill ranges between ${sortedClasses[i - 1].name} (max: ${prevMax}) and ${sortedClasses[i].name} (min: ${currentMin})`);
          }
        }

        // Validate each social class
        config.socialClasses.forEach((sc: any, idx: number) => {
          if (!sc.id) errors.push(`socialClasses[${idx}].id is required`);
          if (!sc.name) errors.push(`socialClasses[${idx}].name is required`);
          if (!sc.financeSkillRange || typeof sc.financeSkillRange.min !== 'number' || typeof sc.financeSkillRange.max !== 'number') {
            errors.push(`socialClasses[${idx}].financeSkillRange is invalid`);
          }
        });
      }
    }

    // Validate formulas
    if (config.formulas) {
      if (!config.formulas.derived || typeof config.formulas.derived !== 'object') {
        errors.push('formulas.derived must be an object');
      }

      if (!Array.isArray(config.formulas.damageBonus) || config.formulas.damageBonus.length === 0) {
        errors.push('formulas.damageBonus must be a non-empty array');
      }
    }

    // Throw error if validation failed
    if (errors.length > 0) {
      const errorMsg = `Invalid character creation configuration:\n${errors.join('\n')}`;
      logger.error('Configuration validation failed', {
        errors,
        configPath: this.configPath
      });
      throw new Error(errorMsg);
    }

    logger.debug('Configuration validation passed', {
      statsCapCheck: `creation:${config.stats.creationCap} <= gameplay:${config.stats.gameplayCap}`,
      skillsCapCheck: `creation:${config.skills.creationCap} <= withOccupation:${config.skills.creationCapWithOccupation} <= gameplay:${config.skills.gameplayCap}`,
      socialClassesCount: config.socialClasses.length
    });
  }

  /**
   * Get default configuration (fallback if file not found)
   */
  private getDefaultConfig(): CharacterCreationConfig {
    logger.warn('Using default character creation configuration');

    return {
      _meta: {
        version: '1.0.0',
        description: 'Default Call of Cthulhu character creation parameters',
        lastUpdated: new Date().toISOString(),
        lastModifiedBy: 'system'
      },
      stats: {
        basePoints: 20,
        totalPoints: 400,
        maxStatsAbove80: 2,
        creationCap: 85,
        gameplayCap: 99,
        minValues: {
          strength: 20,
          dexterity: 20,
          intelligence: 20,
          constitution: 20,
          size: 20,
          charm: 20,
          power: 20,
          education: 20
        },
        description: 'Default stats system'
      },
      skills: {
        totalPointsFormula: 'constant:200',
        intelligenceBonusFormula: 'INT/2',
        creationCap: 75,
        creationCapWithOccupation: 80,
        gameplayCap: 99,
        physicalSkillsExcludeIntBonus: true,
        description: 'Default skill system'
      },
      occupation: {
        requiredSkillMinimum: 40,
        bonusSkillPoints: 30,
        requiredSkillCount: { min: 6, max: 6 },
        bonusSkillCount: { min: 1, max: 1 },
        description: 'Default occupation system'
      },
      limits: {
        age: { min: 16, max: 80 },
        weight: { min: 30, max: 200, unit: 'kg' },
        height: { min: 100, max: 250, unit: 'cm' },
        backgroundFields: {
          briefHistoryMin: 100,
          personalityMin: 50,
          goalsMin: 50,
          maxLength: 4000
        }
      },
      socialClasses: [
        {
          id: 'destitute',
          name: 'Indigente',
          financeSkillRange: { min: 1, max: 9 },
          weeklyCredit: 2,
          initialWealth: { minCash: 5, maxCash: 15 }
        },
        {
          id: 'poor',
          name: 'Povero',
          financeSkillRange: { min: 10, max: 19 },
          weeklyCredit: 5,
          initialWealth: { minCash: 20, maxCash: 40 }
        },
        {
          id: 'modest',
          name: 'Modesto',
          financeSkillRange: { min: 20, max: 39 },
          weeklyCredit: 15,
          initialWealth: { minCash: 50, maxCash: 100 }
        },
        {
          id: 'lower_middle',
          name: 'Piccola borghesia',
          financeSkillRange: { min: 40, max: 49 },
          weeklyCredit: 30,
          initialWealth: { minCash: 150, maxCash: 300 }
        },
        {
          id: 'middle_class',
          name: 'Media borghesia',
          financeSkillRange: { min: 50, max: 69 },
          weeklyCredit: 75,
          initialWealth: { minCash: 400, maxCash: 800 }
        },
        {
          id: 'wealthy',
          name: 'Ricco',
          financeSkillRange: { min: 70, max: 79 },
          weeklyCredit: 150,
          initialWealth: { minCash: 1000, maxCash: 2000 }
        },
        {
          id: 'affluent',
          name: 'Facoltoso',
          financeSkillRange: { min: 80, max: 89 },
          weeklyCredit: 300,
          initialWealth: { minCash: 3000, maxCash: 5000 }
        },
        {
          id: 'elite',
          name: 'Élite',
          financeSkillRange: { min: 90, max: 99 },
          weeklyCredit: 500,
          initialWealth: { minCash: 8000, maxCash: 15000 }
        }
      ],
      formulas: {
        derived: {
          hitPoints: 'FLOOR((constitution + size) / 10)',
          sanityPoints: 'power',
          magicPoints: 'FLOOR(power / 5)',
          luck: 'power',
          idea: 'intelligence',
          knowledge: 'education'
        },
        damageBonus: [
          { maxTotal: 64, bonus: '-2', build: -2 },
          { maxTotal: 84, bonus: '-1', build: -1 },
          { maxTotal: 124, bonus: '0', build: 0 },
          { maxTotal: 164, bonus: '+1d4', build: 1 },
          { maxTotal: 204, bonus: '+1d6', build: 2 },
          { maxTotal: 284, bonus: '+2d6', build: 3 },
          { maxTotal: 364, bonus: '+3d6', build: 4 },
          { maxTotal: 444, bonus: '+4d6', build: 5 },
          { maxTotal: 9999, bonus: '+5d6', build: 6 }
        ]
      }
    };
  }
}

// Export singleton instance getter
export const getCharacterCreationConfig = () => CharacterCreationConfigService.getInstance();

// ==================== FORMULA PARSER FUNCTIONS ====================

/**
 * Parse and calculate intelligence bonus from formula
 * Supports: INT/N, INTxN, INT+N, INT-N, constant:N
 * @param formula - Formula to calculate (e.g., "INT/2", "INTx2", "INT+10", "constant:25")
 * @param intelligenceValue - Intelligence stat value
 * @returns Calculated INT bonus (floored)
 */
export function calculateIntelligenceBonus(formula: string, intelligenceValue: number): number {
  if (!formula) return Math.floor(intelligenceValue / 2); // Default: INT/2

  // Constant formula: "constant:25"
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', '')) || 0;
    return Math.floor(value);
  }

  // Replace "x" with "*" for multiplication (user-friendly)
  let processedFormula = formula.replace(/x/gi, '*');

  // Replace "INT" with actual value
  processedFormula = processedFormula.replace(/INT/gi, intelligenceValue.toString());

  try {
    // Validate: Only allow numbers, +, -, *, /, (, ), ., spaces
    if (!/^[\d+\-*/().\s]+$/.test(processedFormula)) {
      logger.error('Invalid formula characters detected', {
        original: formula,
        processed: processedFormula
      });
      return Math.floor(intelligenceValue / 2); // Fallback
    }

    // Evaluate mathematical expression
    const result = eval(processedFormula);
    return Math.floor(result);
  } catch (error: any) {
    logger.error('Error evaluating intelligence bonus formula', {
      formula,
      intelligenceValue,
      error: error.message
    });
    return Math.floor(intelligenceValue / 2); // Fallback to INT/2
  }
}

/**
 * Validate intelligence bonus formula
 * @param formula - Formula to validate
 * @returns Validation result with error message if invalid
 */
export function validateIntelligenceBonusFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: 'Formula vuota' };
  }

  // Check constant formula
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', ''));
    if (isNaN(value)) {
      return { valid: false, error: 'Costante non valida' };
    }
    return { valid: true };
  }

  // Check INT formula
  if (!formula.includes('INT')) {
    return { valid: false, error: 'Formula deve contenere "INT"' };
  }

  // Replace x with * and INT with 50 for test
  let testFormula = formula.replace(/x/gi, '*').replace(/INT/gi, '50');

  // Check for valid characters only
  if (!/^[\d+\-*/().\s]+$/.test(testFormula)) {
    return { valid: false, error: 'Caratteri non validi (solo +, -, x, /, (, ) permessi)' };
  }

  // Try to evaluate with test value
  try {
    eval(testFormula);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Formula non valida' };
  }
}

/**
 * Get intelligence bonus formula with backward compatibility
 * Falls back to old intelligenceBonusDivisor format if new formula doesn't exist
 * @param config - Character creation configuration
 * @returns Formula string
 */
export function getIntelligenceBonusFormula(config: CharacterCreationConfig): string {
  // New system: formula string
  if (config.skills.intelligenceBonusFormula) {
    return config.skills.intelligenceBonusFormula;
  }

  // Old system: divisor number (backward compatibility)
  // @ts-ignore - intelligenceBonusDivisor may exist in old configs
  if (config.skills.intelligenceBonusDivisor) {
    // @ts-ignore
    return `INT/${config.skills.intelligenceBonusDivisor}`;
  }

  // Default
  return 'INT/2';
}

// ==================== DERIVED STATS PARSER FUNCTIONS ====================

/**
 * Character stats type for formula calculations
 */
export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  size: number;
  intelligence: number;
  education: number;
  power: number;
  charm: number;
}

/**
 * Derived stats result type
 */
export interface DerivedStats {
  ideaRoll: number;
  luckRoll: number;
  knowledge: number;
  hitPoints: number;
  sanityPoints: number;
  magicPoints: number;
  movementRate: number;
  damageBonus: string;
  build: number;
}

/**
 * Damage bonus table entry
 */
export interface DamageBonusEntry {
  maxTotal: number;
  bonus: string;
  build: number;
}

/**
 * Mapping of UPPERCASE abbreviations to database field names
 */
const STAT_MAP: Record<string, keyof CharacterStats> = {
  STR: 'strength',
  DEX: 'dexterity',
  CON: 'constitution',
  SIZ: 'size',
  INT: 'intelligence',
  EDU: 'education',
  POW: 'power',
  APP: 'charm'
};

/**
 * Preprocess formula: replace abbreviations and math functions
 * @param formula - Raw formula string
 * @param stats - Character stats
 * @returns Processed formula ready for evaluation
 */
function preprocessDerivedFormula(formula: string, stats: CharacterStats): string {
  let processed = formula;

  // 1. Replace abbreviations with actual stat values
  for (const [abbr, field] of Object.entries(STAT_MAP)) {
    const value = stats[field] || 50;
    // Use word boundary to avoid replacing part of function names
    processed = processed.replace(new RegExp(`\\b${abbr}\\b`, 'g'), value.toString());
  }

  // 2. Replace math functions with JavaScript equivalents
  processed = processed.replace(/FLOOR\s*\(/gi, 'Math.floor(');
  processed = processed.replace(/CEIL\s*\(/gi, 'Math.ceil(');
  processed = processed.replace(/ROUND\s*\(/gi, 'Math.round(');
  processed = processed.replace(/ABS\s*\(/gi, 'Math.abs(');
  processed = processed.replace(/MIN\s*\(/gi, 'Math.min(');
  processed = processed.replace(/MAX\s*\(/gi, 'Math.max(');

  // 3. Replace user-friendly operators
  processed = processed.replace(/x/gi, '*');

  // 4. Handle IF conditionals - convert to ternary
  // IF(condition, trueVal, falseVal) → (condition ? trueVal : falseVal)
  processed = processed.replace(/IF\s*\(/gi, '(').replace(/,\s*/g, (match, offset) => {
    // Count parentheses to determine if this comma is part of IF
    const before = processed.substring(0, offset);
    const openParens = (before.match(/\(/g) || []).length;
    const closeParens = (before.match(/\)/g) || []).length;

    // If inside an IF statement (more open than close), replace first comma with '?', second with ':'
    if (openParens > closeParens) {
      // This is a simplified approach - a proper implementation would need a parser
      // For now, we'll handle simple IF statements
      return match; // Keep comma as-is for now (will handle in eval)
    }
    return match;
  });

  return processed;
}

/**
 * Calculate derived stat from formula
 * @param formula - Formula string with UPPERCASE abbreviations (e.g., "FLOOR((CON + SIZ) / 10)")
 * @param stats - Character stats object
 * @returns Calculated value (number)
 */
export function calculateDerivedStat(formula: string, stats: CharacterStats): number {
  if (!formula) return 0;

  // Handle constant formulas
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', '')) || 0;
    return Math.floor(value);
  }

  try {
    // Preprocess formula
    let processed = preprocessDerivedFormula(formula, stats);

    // Validate: only allow safe characters (including letters for Math.floor, Math.ceil, etc.)
    if (!/^[\da-zA-Z+\-*/().,<>=!&|\s]+$/.test(processed)) {
      logger.error('Invalid formula characters detected in derived stat', {
        original: formula,
        processed
      });
      return 0;
    }

    // Evaluate mathematical expression
    const result = eval(processed);
    return typeof result === 'number' ? Math.floor(result) : 0;
  } catch (error: any) {
    logger.error('Error evaluating derived stat formula', {
      formula,
      error: error.message
    });
    return 0;
  }
}

/**
 * Validate derived formula syntax
 * @param formula - Formula to validate
 * @returns Validation result with error message if invalid
 */
export function validateDerivedFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: 'Formula vuota' };
  }

  // Check constant formula
  if (formula.startsWith('constant:')) {
    const value = parseInt(formula.replace('constant:', ''));
    if (isNaN(value)) {
      return { valid: false, error: 'Costante non valida' };
    }
    return { valid: true };
  }

  // Check if formula contains at least one stat abbreviation
  const hasStatVar = Object.keys(STAT_MAP).some(abbr => formula.includes(abbr));
  if (!hasStatVar) {
    return {
      valid: false,
      error: 'Formula deve contenere almeno una caratteristica (STR, DEX, CON, SIZ, INT, EDU, POW, APP)'
    };
  }

  // Test with sample stats
  const testStats: CharacterStats = {
    strength: 50,
    dexterity: 50,
    constitution: 50,
    size: 50,
    intelligence: 50,
    education: 50,
    power: 50,
    charm: 50
  };

  try {
    const processed = preprocessDerivedFormula(formula, testStats);

    // Check for valid characters only (including letters for Math.floor, Math.ceil, etc.)
    if (!/^[\da-zA-Z+\-*/().,<>=!&|\s]+$/.test(processed)) {
      return {
        valid: false,
        error: 'Caratteri non validi (solo +, -, *, /, <, >, =, &, |, (, ) e funzioni matematiche permessi)'
      };
    }

    // Try to evaluate
    eval(processed);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Formula non valida o errore di sintassi' };
  }
}

/**
 * Calculate damage bonus and build from table
 * @param stats - Character stats
 * @param table - Damage bonus table from config
 * @returns Damage bonus string and build number
 */
export function calculateDamageBonusTable(
  stats: CharacterStats,
  table: DamageBonusEntry[]
): { bonus: string; build: number } {
  const total = stats.strength + stats.size;

  // Find matching entry in table
  for (const entry of table) {
    if (total <= entry.maxTotal) {
      return {
        bonus: entry.bonus,
        build: entry.build
      };
    }
  }

  // Fallback to last entry if total exceeds all maxTotal values
  const lastEntry = table[table.length - 1];
  return {
    bonus: lastEntry.bonus,
    build: lastEntry.build
  };
}

/**
 * Calculate all derived stats at once
 * @param stats - Character stats
 * @param config - Character creation configuration
 * @returns All derived stats
 */
export function calculateAllDerivedStats(
  stats: CharacterStats,
  config: CharacterCreationConfig
): DerivedStats {
  const formulas = config.formulas?.derived || {};
  const damageTable = config.formulas?.damageBonus || [];

  // Calculate damage bonus and build from table
  const damageData = calculateDamageBonusTable(stats, damageTable);

  return {
    ideaRoll: formulas.ideaRoll ? calculateDerivedStat(formulas.ideaRoll, stats) : stats.intelligence,
    luckRoll: formulas.luck ? calculateDerivedStat(formulas.luck, stats) : stats.power,
    knowledge: formulas.knowledge ? calculateDerivedStat(formulas.knowledge, stats) : stats.education,
    hitPoints: formulas.hitPoints
      ? calculateDerivedStat(formulas.hitPoints, stats)
      : Math.floor((stats.constitution + stats.size) / 10),
    sanityPoints: formulas.sanityPoints
      ? calculateDerivedStat(formulas.sanityPoints, stats)
      : stats.power,
    magicPoints: formulas.magicPoints
      ? calculateDerivedStat(formulas.magicPoints, stats)
      : Math.floor(stats.power / 5),
    movementRate: formulas.movementRate ? calculateDerivedStat(formulas.movementRate, stats) : 8,
    damageBonus: damageData.bonus,
    build: damageData.build
  };
}
