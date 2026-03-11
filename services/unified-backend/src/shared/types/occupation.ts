import { VictorianCurrency } from './economy';

export interface Occupation {
  id: string;
  name: string;
  description: string;
  
  // Social and economic context
  dailySalary: VictorianCurrency; // Daily income paid by "the state"
  socialRespectability: number; // 1-10 scale
  
  // Occupation benefits and bonuses
  benefits?: {
    // Starting equipment/items
    startingItems?: string[];
    
    // Professional skills (specific to this occupation)
    professionalSkills?: string[];
    
    // Skill bonuses
    skillBonuses?: { [skillName: string]: number };
    
    // Stat bonuses
    statBonuses?: { [statName: string]: number };
    
    // Starting wealth bonus
    wealthBonus?: number;
    
    // Special abilities or access
    specialAbilities?: string[];
  };
  
  // Victorian context
  workingConditions: string; // Description of typical working conditions
  
  // Availability
  isActive: boolean; // Can be selected by players
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterOccupationHistory {
  id: string;
  characterId: string;
  occupationId: string;
  
  // Period of employment
  startedAt: Date;
  endedAt?: Date; // null if current occupation
  
  // Employment details
  employer?: string; // Specific employer name
  location?: string; // Where they worked
  salary?: number; // What they earned
  
  // Performance and reputation
  reputation: number; // How well they performed (1-10)
  achievements?: string[]; // Notable accomplishments
  
  // Reason for leaving
  endReason?: 'promotion' | 'dismissal' | 'resignation' | 'retirement' | 'death' | 'other';
  endReasonDetails?: string;
  
  // Current status
  isCurrent: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Predefined occupation categories for organization
export enum OccupationCategory {
  MEDICAL = 'medical',
  LEGAL = 'legal',
  CLERGY = 'clergy',
  MILITARY = 'military',
  EDUCATION = 'education',
  DOMESTIC_SERVICE = 'domestic_service',
  TRADES = 'trades',
  COMMERCE = 'commerce',
  ENTERTAINMENT = 'entertainment',
  CRIMINAL = 'criminal',
  NOBILITY = 'nobility',
  PROFESSIONAL = 'professional',
  INDUSTRIAL = 'industrial',
  TRANSPORTATION = 'transportation',
  AGRICULTURAL = 'agricultural'
}

export interface OccupationWithCategory extends Occupation {
  category: OccupationCategory;
}

// For filtering and searching occupations
export interface OccupationFilter {
  gender?: 'male' | 'female';
  category?: OccupationCategory[];
  minimumIncome?: number;
  maximumIncome?: number;
  characterId?: string; // To check if character meets prerequisites
}

export interface OccupationAvailability {
  occupationId: string;
  isAvailable: boolean;
  missingRequirements?: {
    stats?: { [statName: string]: { required: number; current: number } };
    skills?: { [skillName: string]: { required: number; current: number } };
    items?: string[]; // Missing required items
    corporations?: string[]; // Missing required corporation memberships
    age?: { required: string; current: number };
    other?: string[]; // Other missing requirements
  };
}

// Examples of Victorian occupations with gender restrictions
export const EXAMPLE_OCCUPATIONS = {
  // Male-only occupations
  BARRISTER: 'barrister',
  DOCTOR: 'doctor', 
  SOLICITOR: 'solicitor',
  BANKER: 'banker',
  SHIP_CAPTAIN: 'ship_captain',
  POLICE_CONSTABLE: 'police_constable',
  
  // Female-only occupations  
  GOVERNESS: 'governess',
  LADY_S_MAID: 'ladys_maid',
  SEAMSTRESS: 'seamstress',
  MIDWIFE: 'midwife',
  
  // Gender-specific pairs
  WAITER: 'waiter', // Male
  WAITRESS: 'waitress', // Female
  BUTLER: 'butler', // Male
  HOUSEKEEPER: 'housekeeper', // Female (head of female staff)
  FOOTMAN: 'footman', // Male
  PARLORMAID: 'parlormaid', // Female
} as const;