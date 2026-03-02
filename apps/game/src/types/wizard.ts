/**
 * Wizard Types
 *
 * TypeScript interfaces for Character Creation Wizard.
 * Defines form data structure, validation results, and transformation types.
 *
 * @module types/wizard
 * @since 2.0.0
 */

import type { CharacterStatus } from './character';

/**
 * Skill Breakdown - Granular skill point tracking
 *
 * Used by frontend for budget enforcement.
 * Transformed to VictorianSkills (83 static fields) at submission.
 */
export interface SkillBreakdown {
  /** Computed total: base + requiredBonus + manualPoints + occupationBonus */
  total: number;

  /** Base value from skill definition (e.g., 15 for Accounting) */
  base: number;

  /** Auto-applied for required skills to reach 40 (if < 40) */
  requiredBonus: number;

  /** Player-allocated points (ONLY these count toward budget) */
  manualPoints: number;

  /** Occupation bonus skill: +30 points (can exceed 75, up to 80) */
  occupationBonus: number;

  /** Skill category (Combat, Social, Knowledge, etc.) */
  category?: string;
}

/**
 * Basic Info - Step 1 Data
 */
export interface WizardBasicInfo {
  firstName: string;
  lastName: string;
  birthDate: string; // ISO format
  birthplace: string; // ⚠️ lowercase (backend uses "birthplace" not "birthPlace")
  age: number;
  apparentAge: number;
  gender: string;
  height: string; // Format: "5'10\"" or "178 cm"
  weight: string; // Format: "160 lbs" or "72 kg"
  eyeColor: string;
  hairColor: string;
  visibleMarks: string; // Scars, tattoos, etc.
  hiddenMarks: string; // Hidden scars, birthmarks
  maritalStatus: string; // Single, Married, Widowed, Divorced
  illnesses: string;
  educationTitle: string;
  criminalRecord: string;

  // Step 5 description fields (also in WizardBasicInfo for backend mapping convenience)
  publicDescription?: string; // Public background visible to all
  privateDescription?: string; // Private background visible only to owner/master
  physicalDescription?: string; // Physical appearance description
}

/**
 * Occupation - Step 2 Data
 */
export interface WizardOccupation {
  /** Occupation ID from database */
  occupationId: string;

  /** Current occupation title (user-editable string) */
  currentOccupation: string;

  /** For occupations with alternative skill choices (e.g., Artist: Painting/Sculpture) */
  selectedAlternativeSkills: Record<string, string>;

  /** Flag: occupation bonuses have been applied to skills */
  occupationBonusesApplied: boolean;

  /** Placeholder skill names required by this occupation (e.g., ["Lingua straniera"]) */
  requiredPlaceholderSkills: string[];
}

/**
 * Stats - Step 3 Data
 */
export interface WizardStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  appearance: number; // ⚠️ Archive uses "charm", backend uses "appearance"
  power: number;
  size: number;
  education: number;
}

/**
 * Derived Stats - Calculated from base stats
 */
export interface DerivedStats {
  hitPoints: number; // FLOOR((CON + SIZ) / 10)
  sanity: number; // POW
  maxSanity: number; // 99 - Cthulhu Mythos skill
  magicPoints: number; // FLOOR(POW / 5)
  luck: number; // POW (rolled separately in some systems)
}

/**
 * Background - Step 5 Data
 */
export interface WizardBackground {
  /** 9 structured questions (childhood, family, mentors, etc.) - Optional (alternative to direct fields) */
  backgroundResponses?: Array<{
    question: string;
    response: string;
  }>;

  /** Alternative structured format (backend accepts both) */
  guidedBackground?: {
    childhood: string;
    family: string;
    mentors: string;
    fears: string;
    secrets: string;
    motivations: string;
    relationships: string;
    goals: string;
    flaws: string;
  };

  /**
   * Backend Character.background schema fields
   * Match the structure in services/unified-backend/src/database/models/Character.ts
   */
  briefHistory?: string; // Storia in breve (max 4000 caratteri)
  significantEvents?: string; // Fatti salienti
  importantRelationships?: string; // Relazioni importanti
  personality?: string; // Personalità
  ideology?: string; // Ideologia/Credo
  significantPlaces?: string; // Luoghi significativi
  fearsAndPhobias?: string; // Paure e fobie (private)
  secrets?: string; // Segreti (private)
  goalsAndMotivations?: string; // Obiettivi e motivazioni
}

/**
 * Dynamic Skill Entry
 *
 * For specializations (Art: Painting, Science: Chemistry, etc.)
 */
export interface DynamicSkill {
  skillId: string;
  name: string;
  specialization?: string;
}

/**
 * Complete Wizard Data - All Steps Combined
 */
export interface WizardData {
  currentStep: number;
  basicInfo: WizardBasicInfo;
  occupation: WizardOccupation;
  stats: WizardStats;
  derivedStats: DerivedStats;
  skills: Record<string, SkillBreakdown>; // Dynamic skill map
  dynamicSkills: DynamicSkill[]; // Unlocked specializations
  background: WizardBackground;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  /** Is validation successful? */
  valid: boolean;

  /** Error messages keyed by field name */
  errors: Record<string, string>;

  /** Warnings (non-blocking) */
  warnings?: Record<string, string>;
}

/**
 * Field Validation Error
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Stats Validation Config (from character-creation.json)
 */
export interface StatsConfig {
  basePoints: number; // Usually 20
  totalPoints: number; // Usually 400
  maxStatsAbove80: number; // Usually 2
  creationCap: number; // Usually 85
  gameplayCap: number; // Usually 99
}

/**
 * Skills Validation Config (from character-creation.json)
 */
export interface SkillsConfig {
  totalPointsFormula: string; // "constant:200"
  intelligenceBonusFormula: string; // "INT/2"
  creationCap: number; // 75
  creationCapWithOccupation: number; // 80
  gameplayCap: number; // 99
  physicalSkillsExcludeIntBonus: boolean; // true
}

/**
 * Occupation Config (from character-creation.json)
 */
export interface OccupationConfig {
  requiredSkillMinimum: number; // 40
  bonusSkillPoints: number; // 30
  requiredSkillCount: { min: number; max: number }; // { min: 6, max: 6 }
  bonusSkillCount: { min: number; max: number }; // { min: 1, max: 1 }
}

/**
 * Character Creation Complete Config
 */
export interface CharacterCreationConfig {
  stats: StatsConfig;
  skills: SkillsConfig;
  occupation: OccupationConfig;
  formulas: {
    derived: Record<string, string>; // HP, Sanity, Magic, Luck formulas
    damageBonus: Array<{ minTotal: number; maxTotal: number; bonus: string }>;
  };
}

/**
 * Character Create Payload - Backend API Format
 *
 * Transformed from WizardData at submission.
 * Includes field name reconciliation (charm→appearance, birthPlace→birthplace, etc.)
 */
export interface CharacterCreatePayload {
  // Basic info (field name reconciliation)
  name: string; // firstName + ' ' + lastName
  birthplace: string; // lowercase!
  age: number;
  apparentAge: number;
  gender: string;
  height: string;
  weight: string;
  eyeColor: string;
  hairColor: string;
  visibleMarks: string;
  hiddenMarks: string;
  maritalStatus: string;
  illnesses: string;
  educationTitle: string;
  criminalRecord: string;

  // Occupation
  occupation: string; // occupationId
  currentOccupation: string;

  // Stats (use "appearance" not "charm")
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    constitution: number;
    appearance: number; // NOT charm!
    power: number;
    size: number;
    education: number;
    sanity: number;
    maxSanity: number;
    hitPoints: number;
    magicPoints: number;
    luck: number;
  };

  // Skills (transformed to VictorianSkills - 83 static fields)
  skills: Record<string, number>; // Will be cast to VictorianSkills

  // Description fields (from Step 5)
  publicDescription?: string; // Public background visible to all
  privateDescription?: string; // Private background visible only to owner/master
  physicalDescription?: string; // Physical appearance description

  // Background (send both formats for safety)
  backgroundResponses?: Array<{ question: string; response: string }>;
  guidedBackground?: {
    childhood: string;
    family: string;
    mentors: string;
    fears: string;
    secrets: string;
    motivations: string;
    relationships: string;
    goals: string;
    flaws: string;
  };
  background?: {
    briefHistory?: string; // Storia in breve
    significantEvents?: string; // Fatti salienti
    importantRelationships?: string; // Relazioni importanti
    personality?: string; // Personalità
    ideology?: string; // Ideologia/Credo
    significantPlaces?: string; // Luoghi significativi
    fearsAndPhobias?: string; // Paure e fobie (private)
    secrets?: string; // Segreti (private)
    goalsAndMotivations?: string; // Obiettivi e motivazioni
  };

  // Metadata
  status: CharacterStatus; // Always 'DRAFT' initially
}

/**
 * Occupation Definition
 *
 * From backend or static config.
 */
export interface Occupation {
  _id: string;
  name: string;
  category: string; // Professional, Military, Academic, etc.
  description: string;
  creditRatingRange: { min: number; max: number };

  /** 6 required skills (auto-boost to 40) */
  requiredSkills: Array<{
    name: string;
    alternatives?: string[]; // For choice-based skills
  }>;

  /** 1 bonus skill (user chooses, +30 points) */
  bonusSkills: string[];
}

/**
 * Skill Definition
 *
 * From backend or static config.
 */
export interface SkillDefinition {
  name: string;
  base: number; // Base value (e.g., 15 for Accounting)
  category: string; // Combat, Social, Knowledge, etc.
  description: string;
  isPhysical?: boolean; // If true, doesn't get INT bonus
  allowsSpecialization?: boolean; // Art, Science, Language, etc.
}
