/**
 * Game Types
 *
 * TypeScript interfaces for game data structures (occupations, skills, etc.)
 * Mirrors backend shared types for type safety.
 *
 * @module types/game
 * @since 3.0.0
 */

/**
 * Occupation Category
 *
 * Matches backend OccupationCategory enum.
 */
export type OccupationCategory =
  | 'agricoltura'
  | 'alto_bordo'
  | 'ambito_militare'
  | 'artigianato'
  | 'assistenza_salute'
  | 'attivita_illegali'
  | 'commercio'
  | 'cultura'
  | 'domestico'
  | 'edilizia_ingegneria'
  | 'gioco_azzardo'
  | 'governo_amministrazione'
  | 'intrattenimento'
  | 'legge_ordine'
  | 'marina_trasporti'
  | 'politica'
  | 'servizio_pubblico'
  | 'trasporti_comunicazioni';

/**
 * Required Skill Slot
 *
 * Occupation skill requirement with optional alternatives.
 */
export interface RequiredSkillSlot {
  /** Skill IDs (one if fixed, multiple if player chooses) */
  options: Array<{
    skillId: string;
    name: string;
  }>;
}

/**
 * Occupation Data
 *
 * Complete occupation definition from backend.
 * Returned by GET /game/occupations.
 */
export interface OccupationData {
  /** Occupation MongoDB _id */
  _id: string;

  /** Display name */
  name: string;

  /** Full description */
  description: string;

  /** Category for organization */
  category: OccupationCategory;

  /** Typical contacts for this occupation */
  contacts: string;

  /** Earnings range (e.g., "Lower Middle Class - Alta Borghesia") */
  earnings: string;

  /** Required skill slots (player picks one from each) */
  requiredSkillSlots: RequiredSkillSlot[];

  /** Bonus skill slots (occupation bonus +30) */
  bonusSkillSlots: RequiredSkillSlot[];

  /** Whether this occupation is available to male characters */
  availableForMale: boolean;

  /** Whether this occupation is available to female characters */
  availableForFemale: boolean;

  /** Minimum education required */
  minimumEducation?: number;

  /** Whether this occupation is soft-deleted */
  isDeleted?: boolean;
}

/**
 * Skill Definition
 *
 * Base skill data from backend.
 * Returned by GET /game/skills.
 */
export interface SkillDefinition {
  /** Skill unique identifier (e.g., "accounting", "art") */
  id: string;

  /** Display name */
  name: string;

  /** Base value (e.g., 15 for Accounting) */
  base: number;

  /** Skill category (Combat, Social, Knowledge, etc.) */
  category?: string;

  /** Optional description */
  description?: string;
}

/**
 * Character Skill
 *
 * Skill with character-specific value.
 * Returned by GET /game/skills/character/:characterId.
 */
export interface CharacterSkill {
  /** Skill unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Character's current skill value */
  value: number;

  /** Skill category */
  category?: string;
}
