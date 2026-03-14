export interface Occupation {
  id: string;
  name: string;
  description: string;
  
  // Category for organization (from esperienze_pregresse.txt - 18 categories)
  category: OccupationCategory;
  
  // Display information (matches Occupation model)
  contacts: string;
  earnings: string;
  
  // Occupation benefits and bonuses (legacy/optional)
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
  
  // Victorian context (optional - model uses contacts/earnings)
  workingConditions?: string; // Description of typical working conditions
  
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
  endReason?: 'promotion' | 'dismissal' | 'resignation' | 'retirement' | 'death' | 'career_change' | 'other';
  endReasonDetails?: string;
  
  // Current status
  isCurrent: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Predefined occupation categories for organization (from esperienze_pregresse.txt - matches Occupation model)
export enum OccupationCategory {
  AVVENTURIERI = 'avventurieri',
  ARTI_CREATIVE = 'arti_creative',
  ARTISTI_SPETTACOLO = 'artisti_spettacolo',
  SPORT = 'sport',
  AFFARI = 'affari',
  RELIGIOSI = 'religiosi',
  CRIMINALI = 'criminali',
  GIORNALISMO = 'giornalismo',
  LAVORO_RURALE = 'lavoro_rurale',
  LAVORO_URBANO = 'lavoro_urbano',
  TUTORI_ORDINE = 'tutori_ordine',
  PROFESSIONE_LEGALE = 'professione_legale',
  OPERATORI_SANITARI = 'operatori_sanitari',
  SALUTE_MENTALE = 'salute_mentale',
  FORZE_ARMATE = 'forze_armate',
  POLITICA = 'politica',
  STUDIOSI = 'studiosi',
  PROFESSIONI_VARIE = 'professioni_varie'
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