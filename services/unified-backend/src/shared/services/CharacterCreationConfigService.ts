/**
 * Character Creation Configuration Service
 *
 * Manages loading, saving, and validation of character creation configuration
 * from SystemConfiguration database.
 *
 * Features:
 * - Singleton pattern for global access
 * - Redis caching via ConfigurationService
 * - Audit trail for all configuration changes
 * - Validation of configuration structure and constraints
 * - Helper methods for calculations (skill points, social class, damage bonus)
 */

import { createLogger } from '../utils/logger';
import { ConfigurationService } from './ConfigurationService';

const logger = createLogger({ serviceName: 'CharacterCreationConfigService' });

// ==================== HELPERS ====================

const DEFAULT_BG_FIELDS = {
  briefHistory:           { minChar: 50,  maxChar: 4000 },
  significantEvents:      { minChar: 0,   maxChar: 2500 },
  importantRelationships: { minChar: 0,   maxChar: 2500 },
  personality:            { minChar: 50,  maxChar: 2500 },
  ideology:               { minChar: 0,   maxChar: 2500 },
};

/**
 * Normalizes backgroundFields from DB, handling both the old flat format
 * ({ briefHistoryMin, personalityMin, goalsMin, maxLength }) and the new
 * per-field format ({ briefHistory: { minChar, maxChar }, ... }).
 */
function normalizeBgFields(raw: any): typeof DEFAULT_BG_FIELDS {
  if (!raw) return DEFAULT_BG_FIELDS;

  // Already in new per-field format
  if (raw.briefHistory && typeof raw.briefHistory === 'object') {
    return {
      briefHistory:           raw.briefHistory           || DEFAULT_BG_FIELDS.briefHistory,
      significantEvents:      raw.significantEvents      || DEFAULT_BG_FIELDS.significantEvents,
      importantRelationships: raw.importantRelationships || DEFAULT_BG_FIELDS.importantRelationships,
      personality:            raw.personality            || DEFAULT_BG_FIELDS.personality,
      ideology:               raw.ideology               || DEFAULT_BG_FIELDS.ideology,
    };
  }

  // Old flat format — migrate on the fly using new default values
  return { ...DEFAULT_BG_FIELDS };
}

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
    requiredSkillCount: { min: number; max: number };
    bonusSkillCount: { min: number; max: number };
    bonusSkillPoints: number;
    description: string;
  };
  limits: {
    age: { min: number; max: number };
    weight: { min: number; max: number; unit: string };
    height: { min: number; max: number; unit: string };
    backgroundFields: {
      briefHistory:           { minChar: number; maxChar: number };
      significantEvents:      { minChar: number; maxChar: number };
      importantRelationships: { minChar: number; maxChar: number };
      personality:            { minChar: number; maxChar: number };
      ideology:               { minChar: number; maxChar: number };
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
  /**
   * Visibilità dei campi del personaggio.
   * true = pubblico (visibile a tutti), false = privato (solo master/owner).
   * Usato dal wizard per mostrare l'EyeIcon e da characterVisibility.ts per filtrare.
   */
  fieldVisibility: Record<string, boolean>;
}

// ==================== SERVICE CLASS ====================

export class CharacterCreationConfigService {
  private static instance: CharacterCreationConfigService;
  private configService: ConfigurationService;

  private constructor() {
    // Import redis client dynamically to avoid circular dependencies
    const { redisClient } = require('@config/runtime/redis');
    this.configService = new ConfigurationService(redisClient, logger);
  }

  public static getInstance(): CharacterCreationConfigService {
    if (!CharacterCreationConfigService.instance) {
      CharacterCreationConfigService.instance = new CharacterCreationConfigService();
    }
    return CharacterCreationConfigService.instance;
  }

  /**
   * Load configuration from SystemConfiguration database with Redis caching
   */
  public async loadConfig(): Promise<CharacterCreationConfig> {
    // Fetch all character_creation section configs (Redis-cached by ConfigurationService)
    const configs = await this.configService.getConfigsBySection('character_creation');

    // Reconstruct JSON structure from DB records (defaults for safety only)
    return {
      _meta: configs['character_creation_meta'] || {
        version: '1.0.0',
        description: 'TenPennyNovels - Call of Cthulhu Victorian RPG Character Creation Configuration',
        lastUpdated: new Date().toISOString(),
        lastModifiedBy: 'system',
      },
      stats: {
        basePoints: configs['character_creation_stats_base_points'] || 20,
        totalPoints: configs['character_creation_stats_total_points'] || 400,
        maxStatsAbove80: configs['character_creation_stats_max_above_80'] || 2,
        creationCap: configs['character_creation_stats_creation_cap'] || 85,
        gameplayCap: configs['character_creation_stats_gameplay_cap'] || 99,
        minValues: configs['character_creation_stats_min_values'] || {
          strength: 20,
          dexterity: 20,
          intelligence: 20,
          constitution: 20,
          size: 20,
          appearance: 20,
          power: 20,
          education: 20,
        },
        description: configs['character_creation_stats_description'] || '',
      },
      skills: {
        totalPointsFormula: configs['character_creation_skills_total_points_formula'] || 'constant:200',
        intelligenceBonusFormula: configs['character_creation_skills_int_bonus_formula'] || 'INT/2',
        creationCap: configs['character_creation_skills_creation_cap'] || 75,
        creationCapWithOccupation: configs['character_creation_skills_creation_cap_with_occupation'] || 80,
        gameplayCap: configs['character_creation_skills_gameplay_cap'] || 99,
        physicalSkillsExcludeIntBonus: configs['character_creation_skills_physical_exclude_int_bonus'] ?? true,
        description: configs['character_creation_skills_description'] || '',
      },
      occupation: {
        requiredSkillMinimum: configs['character_creation_occupation_required_skill_minimum'] || 40,
        requiredSkillCount: configs['character_creation_occupation_required_skill_count'] || { min: 6, max: 6 },
        bonusSkillCount: configs['character_creation_occupation_bonus_skill_count'] || { min: 1, max: 1 },
        bonusSkillPoints: configs['character_creation_occupation_bonus_skill_points'] || 30,
        description: configs['character_creation_occupation_description'] || '',
      },
      limits: {
        age: configs['character_creation_limits_age'] || { min: 16, max: 80 },
        weight: configs['character_creation_limits_weight'] || { min: 30, max: 200, unit: 'kg' },
        height: configs['character_creation_limits_height'] || { min: 100, max: 250, unit: 'cm' },
        backgroundFields: normalizeBgFields(configs['character_creation_limits_background_fields']),
      },
      socialClasses: configs['character_creation_social_classes'] || this.getDefaultSocialClasses(),
      formulas: {
        derived: configs['character_creation_formulas_derived'] || {
          hitPoints: 'FLOOR((CON + SIZ) / 10)',
          sanity: 'POW',
          magicPoints: 'FLOOR(POW / 5)',
          luck: 'POW',
          ideaRoll: 'INT',
          knowledge: 'EDU',
          movementRate: '8',
        },
        damageBonus: configs['character_creation_formulas_damage_bonus'] || this.getDefaultDamageBonus(),
      },
      fieldVisibility: configs['character_creation_field_visibility'] || {
        name: true,
        surname: true,
        apparentAge: true,
        gender: true,
        height: true,
        weight: true,
        occupation: true,
        briefHistory: true,
        significantEvents: true,
        importantRelationships: true,
        personality: true,
        ideology: true,
        birthDate: false,
        maritalStatus: false,
        hiddenMarks: false,
        pathologies: false,
        criminalRecord: false,
        educationTitle: false,
      },
    };
  }

  /**
   * Save configuration to SystemConfiguration database
   */
  public async saveConfig(
    config: CharacterCreationConfig,
    modifiedBy: string
  ): Promise<void> {
    // Update metadata
    config._meta.lastUpdated = new Date().toISOString();
    config._meta.lastModifiedBy = modifiedBy;

    // Validate before saving
    this.validateConfig(config);

    // Map all config fields to SystemConfiguration keys
    const updates = [
      { key: 'character_creation_meta', value: config._meta },
      { key: 'character_creation_stats_base_points', value: config.stats.basePoints },
      { key: 'character_creation_stats_total_points', value: config.stats.totalPoints },
      { key: 'character_creation_stats_max_above_80', value: config.stats.maxStatsAbove80 },
      { key: 'character_creation_stats_creation_cap', value: config.stats.creationCap },
      { key: 'character_creation_stats_gameplay_cap', value: config.stats.gameplayCap },
      { key: 'character_creation_stats_min_values', value: config.stats.minValues },
      { key: 'character_creation_stats_description', value: config.stats.description },
      { key: 'character_creation_skills_total_points_formula', value: config.skills.totalPointsFormula },
      { key: 'character_creation_skills_int_bonus_formula', value: config.skills.intelligenceBonusFormula },
      { key: 'character_creation_skills_creation_cap', value: config.skills.creationCap },
      { key: 'character_creation_skills_creation_cap_with_occupation', value: config.skills.creationCapWithOccupation },
      { key: 'character_creation_skills_gameplay_cap', value: config.skills.gameplayCap },
      { key: 'character_creation_skills_physical_exclude_int_bonus', value: config.skills.physicalSkillsExcludeIntBonus },
      { key: 'character_creation_skills_description', value: config.skills.description },
      { key: 'character_creation_occupation_required_skill_minimum', value: config.occupation.requiredSkillMinimum },
      { key: 'character_creation_occupation_required_skill_count', value: config.occupation.requiredSkillCount },
      { key: 'character_creation_occupation_bonus_skill_count', value: config.occupation.bonusSkillCount },
      { key: 'character_creation_occupation_bonus_skill_points', value: config.occupation.bonusSkillPoints },
      { key: 'character_creation_occupation_description', value: config.occupation.description },
      { key: 'character_creation_limits_age', value: config.limits.age },
      { key: 'character_creation_limits_weight', value: config.limits.weight },
      { key: 'character_creation_limits_height', value: config.limits.height },
      { key: 'character_creation_limits_background_fields', value: config.limits.backgroundFields },
      { key: 'character_creation_social_classes', value: config.socialClasses },
      { key: 'character_creation_formulas_derived', value: config.formulas.derived },
      { key: 'character_creation_formulas_damage_bonus', value: config.formulas.damageBonus },
      { key: 'character_creation_field_visibility', value: config.fieldVisibility },
    ];

    // Save all config keys to DB (audit trail handled by ConfigurationService)
    for (const { key, value } of updates) {
      await this.configService.updateConfig(
        key,
        value,
        modifiedBy,
        'Admin config update via CharacterCreationConfigController'
      );
    }

    logger.info('Character creation config saved to DB successfully', {
      version: config._meta.version,
      modifiedBy,
      keysUpdated: updates.length,
    });
  }

  /**
   * Invalidate cache (Redis cache managed by ConfigurationService)
   *
   * Note: Cache invalidation now handled automatically by ConfigurationService
   * when configs are updated. This method is kept for backward compatibility.
   */
  public async invalidateCache(): Promise<void> {
    // ConfigurationService handles cache invalidation automatically via Redis pub/sub
    // when updateConfig() is called, so explicit invalidation is rarely needed.
    // Invalidate all system configuration cache:
    await this.configService.invalidateAllCache();
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
        source: 'SystemConfiguration database'
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
   * Get default social classes (used as fallback)
   */
  private getDefaultSocialClasses() {
    return [
      {
        id: 'destitute',
        name: 'Indigente',
        financeSkillRange: { min: 1, max: 9 },
        weeklyCredit: 480,
        initialWealth: { minCash: 1200, maxCash: 3600 }
      },
      {
        id: 'poor',
        name: 'Povero',
        financeSkillRange: { min: 10, max: 19 },
        weeklyCredit: 1200,
        initialWealth: { minCash: 4800, maxCash: 9600 }
      },
      {
        id: 'modest',
        name: 'Modesto',
        financeSkillRange: { min: 20, max: 39 },
        weeklyCredit: 3600,
        initialWealth: { minCash: 12000, maxCash: 24000 }
      },
      {
        id: 'lower_middle',
        name: 'Piccola borghesia',
        financeSkillRange: { min: 40, max: 49 },
        weeklyCredit: 7200,
        initialWealth: { minCash: 36000, maxCash: 72000 }
      },
      {
        id: 'middle_class',
        name: 'Media borghesia',
        financeSkillRange: { min: 50, max: 69 },
        weeklyCredit: 18000,
        initialWealth: { minCash: 96000, maxCash: 192000 }
      },
      {
        id: 'wealthy',
        name: 'Ricco',
        financeSkillRange: { min: 70, max: 79 },
        weeklyCredit: 36000,
        initialWealth: { minCash: 240000, maxCash: 480000 }
      },
      {
        id: 'affluent',
        name: 'Facoltoso',
        financeSkillRange: { min: 80, max: 89 },
        weeklyCredit: 72000,
        initialWealth: { minCash: 720000, maxCash: 1200000 }
      },
      {
        id: 'elite',
        name: 'Élite',
        financeSkillRange: { min: 90, max: 99 },
        weeklyCredit: 120000,
        initialWealth: { minCash: 1920000, maxCash: 3600000 }
      }
    ];
  }

  /**
   * Get default damage bonus table (used as fallback)
   */
  private getDefaultDamageBonus() {
    return [
      { maxTotal: 64, bonus: '-2', build: -2 },
      { maxTotal: 84, bonus: '-1', build: -1 },
      { maxTotal: 124, bonus: '0', build: 0 },
      { maxTotal: 164, bonus: '+1d4', build: 1 },
      { maxTotal: 204, bonus: '+1d6', build: 2 },
      { maxTotal: 284, bonus: '+2d6', build: 3 },
      { maxTotal: 364, bonus: '+3d6', build: 4 },
      { maxTotal: 444, bonus: '+4d6', build: 5 },
      { maxTotal: 9999, bonus: '+5d6', build: 6 }
    ];
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
          appearance: 20,
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
        requiredSkillCount: { min: 6, max: 6 },
        bonusSkillCount: { min: 1, max: 1 },
        bonusSkillPoints: 30,
        description: 'Default occupation system'
      },
      limits: {
        age: { min: 16, max: 80 },
        weight: { min: 30, max: 200, unit: 'kg' },
        height: { min: 100, max: 250, unit: 'cm' },
        backgroundFields: {
          briefHistory:           { minChar: 50,  maxChar: 4000 },
          significantEvents:      { minChar: 0,   maxChar: 2500 },
          importantRelationships: { minChar: 0,   maxChar: 2500 },
          personality:            { minChar: 50,  maxChar: 2500 },
          ideology:               { minChar: 0,   maxChar: 2500 },
        }
      },
      socialClasses: this.getDefaultSocialClasses(),
      formulas: {
        derived: {
          hitPoints: 'FLOOR((constitution + size) / 10)',
          sanity: 'power',
          magicPoints: 'FLOOR(power / 5)',
          luck: 'power',
          idea: 'intelligence',
          knowledge: 'education'
        },
        damageBonus: this.getDefaultDamageBonus()
      },
      fieldVisibility: {
        name: true,
        surname: true,
        apparentAge: true,
        gender: true,
        height: true,
        weight: true,
        occupation: true,
        briefHistory: true,
        significantEvents: true,
        importantRelationships: true,
        personality: true,
        ideology: true,
        birthDate: false,
        maritalStatus: false,
        hiddenMarks: false,
        pathologies: false,
        criminalRecord: false,
        educationTitle: false,
      },
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
  appearance: number;
}

/**
 * Derived stats result type
 */
export interface DerivedStats {
  ideaRoll: number;
  luckRoll: number;
  knowledge: number;
  hitPoints: number;
  sanity: number;
  maxSanity: number;
  magicPoints: number;
  movementRate: number;
  bonusDamage: string;
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
  APP: 'appearance'
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
    appearance: 50
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
    sanity: formulas.sanity
      ? calculateDerivedStat(formulas.sanity, stats)
      : stats.power,
    maxSanity: 99,
    magicPoints: formulas.magicPoints
      ? calculateDerivedStat(formulas.magicPoints, stats)
      : Math.floor(stats.power / 5),
    movementRate: formulas.movementRate ? calculateDerivedStat(formulas.movementRate, stats) : 8,
    bonusDamage: damageData.bonus,
    build: damageData.build
  };
}
