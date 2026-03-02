/**
 * Type definitions for complete bot character generation
 * These types define the structure for generating fully-featured bot characters
 * with complete stats, skills, occupation, background, and demographics
 */

/**
 * Skill breakdown structure matching Character model format
 */
export interface SkillBreakdown {
  total: number;              // Computed: base + requiredBonus + manualPoints + occupationBonus
  base: number;               // From skill definition (formula or fixed)
  requiredBonus: number;      // Auto-applied: (40 - base) for required skills
  manualPoints: number;       // AI-allocated points (ONLY these count toward budget)
  occupationBonus: number;    // From occupation.bonusSkills (+30 for selected bonus skill)
  category?: string;          // Skill category
}

/**
 * Character stats (8 stats, typical total ~400 points)
 */
export interface CharacterStats {
  strength: number;       // STR
  constitution: number;   // CON
  size: number;          // SIZ
  dexterity: number;     // DEX
  charm: number;         // CHA
  intelligence: number;  // INT
  power: number;         // POW
  education: number;     // EDU
}

/**
 * Skills map with breakdown for each skill
 */
export interface SkillsMap {
  [skillName: string]: SkillBreakdown;
}

/**
 * Occupation reference
 */
export interface OccupationReference {
  _id: string;
  name: string;
}

/**
 * Complete character background structure
 */
export interface CharacterBackground {
  briefHistory: string;
  personality: string;
  ideology: string;
  importantPeople: string;
  importantPlaces: string;
  treasuredPossessions: string;
  traits: string;
  goals: string;
  fears: string;
  secrets: string;
}

/**
 * Character demographics
 */
export interface CharacterDemographics {
  age: number;
  height: string;
  weight: string;
  eyeColor: string;
  hairColor: string;
  physicalDescription: string;
  publicDescription: string;
  privateDescription: string;
}

/**
 * Complete character payload for game-backend
 */
export interface CompleteCharacterPayload {
  name: string;
  surname?: string;
  bot_id: string;
  stats: CharacterStats;
  skills: SkillsMap;
  occupation: OccupationReference;
  background: CharacterBackground;
  demographics: CharacterDemographics;
  gender: 'male' | 'female';
  campaign_id?: string;
}

/**
 * AI-generated core character data (Stage 1 output)
 */
export interface CoreCharacterData {
  stats: CharacterStats;
  occupationSuggestions: string[];  // 3-5 occupation names
  demographics: {
    age: number;
    height: string;
    weight: string;
    eyeColor: string;
    hairColor: string;
    physicalDescription: string;
  };
  background: CharacterBackground;
}

/**
 * Occupation from database
 */
export interface Occupation {
  _id: string;
  name: string;
  requiredSkills: string[];      // 6 skills that must be >= 40
  bonusSkills: string[];         // 1-2 skills that get +30
  description?: string;
  category?: string;
  socialClass?: string;
}

/**
 * Skill from database
 */
export interface Skill {
  _id: string;
  name: string;
  baseValue: string | number;  // Can be number, "VALUE:XX", or "FORMULA:CHAR"
  category: string;
  description?: string;
}

/**
 * Skill budget tracking
 */
export interface SkillBudget {
  intPoints: number;      // intelligence * 2
  basePoints: number;     // Fixed 100 points
  total: number;          // intPoints + basePoints
  used: number;           // Track points used
  remaining: number;      // total - used
}

/**
 * AI skill prioritization (Stage 5 input)
 */
export interface SkillPriority {
  skillName: string;
  suggestedPoints: number;  // 10-30 points
  reason?: string;
}

/**
 * Complete bot data combining bot and character
 */
export interface CompleteBot {
  bot: {
    _id: string;
    name: string;
    surname?: string;
    gender: 'male' | 'female';
    personality: {
      traits: string[];
      values: string[];
      goals: string[];
    };
    background?: string;
  };
  character: CompleteCharacterPayload;
}

/**
 * Bot generation parameters
 */
export interface BotGenerationParams {
  name: string;
  surname?: string;
  gender: 'male' | 'female';
  personality: {
    traits: string[];
    values: string[];
    goals: string[];
  };
  background?: string;
  campaign_id?: string;
  publicDescription?: string;
  privateDescription?: string;
}

/**
 * Occupation requirements for matching
 */
export interface OccupationRequirements {
  stats: CharacterStats;
  personalityTraits: string[];
  suggestions: string[];
}
