import { SocialClass, SocialClassInfo } from './socialClass';

export enum CharacterStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  DELETED = 'DELETED'
}

export interface CallOfCthulhuStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  appearance: number;
  power: number;
  size: number;
  education: number;
  // Derived stats
  sanity: number;
  maxSanity: number;
  hitPoints: number;
  magicPoints: number;
  luck: number;
}

export interface VictorianSkills {
  // Core skills
  accounting: number;
  anthropology: number;
  appraise: number;
  archaeology: number;
  art: number;
  astronomy: number;
  bargain: number;
  biology: number;
  chemistry: number;
  climb: number;
  conceal: number;
  creditRating: number;
  cthulhuMythos: number;
  dodge: number;
  driveCarriage: number;
  electricalRepair: number;
  fastTalk: number;
  firstAid: number;
  geology: number;
  hide: number;
  history: number;
  jump: number;
  law: number;
  libraryUse: number;
  listen: number;
  locksmith: number;
  martialArts: number;
  mechanicalRepair: number;
  medicine: number;
  naturalWorld: number;
  navigate: number;
  occult: number;
  operateHeavyMachinery: number;
  ownLanguage: number;
  otherLanguage: number;
  persuade: number;
  pharmacy: number;
  photography: number;
  physics: number;
  pickpocket: number;
  pilot: number;
  psychology: number;
  psychoanalysis: number;
  ride: number;
  sneak: number;
  spotHidden: number;
  swim: number;
  throw: number;
  track: number;
  // Victorian specific
  etiquette: number;
  riding: number;
  firearms: number;
  fencing: number;
}

export interface Character {
  id: string;
  userId: string;
  name: string; // identità di gioco (= username), immutabile
  firstName?: string; // nome di finzione (RP) - visibile a tutti
  age: number;
  apparentAge: number; // età apparente - visibile a tutti
  birthDate?: string; // data di nascita in formato gg/mm/yyyy (es: "14/4/1844") - visibile solo ai master
  physicalDescription: string; // aspetto fisico - visibile a tutti
  nationality: string; // nazionalità - visibile solo ai master
  publicDescription: string; // descrizione pubblica - visibile a tutti
  gender: 'male' | 'female';
  occupation: string; // Current occupation ID
  occupationHistory: string[]; // Array of occupation IDs in chronological order
  currentOccupation?: string; // Free text field for current occupation (Info generali)
  residence: string;
  birthPlace: string;
  visibleMarks?: string; // segni particolari visibili (PUBLIC)
  hiddenMarks?: string; // segni particolari non visibili (PRIVATE - owner/master only)
  
  // Physical description
  description: string; // deprecato
  avatar?: string; // URL or path to character avatar image
  audioTheme?: string; // URL or path to character theme audio
  
  // Social class and background
  socialClass: SocialClass;
  socialClassInfo?: SocialClassInfo; // Optional computed field - populated by API
  background: string;
  
  // Background questionnaire responses
  backgroundResponses: {
    questionId: string;
    response: string; 
    answeredAt: Date;
    questionVersion: number;
  }[];
  
  // Background completion status
  backgroundCompleted: boolean;
  backgroundCompletedAt?: Date;

  // Call of Cthulhu stats
  stats: CallOfCthulhuStats;
  skills: VictorianSkills;
  
  // Character status and approval (playerStatus: nuovo standard; status: legacy)
  status?: CharacterStatus;
  playerStatus?: 'draft' | 'pending' | 'approved';
  statusNote?: string; // Staff notes for approval/rejection
  
  // Economy and possessions
  inventoryId: string; // Reference to CharacterInventory
  
  // Current game state
  currentLocation: string; // Location ID
  isActive: boolean; // Currently selected character

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string; // Staff user ID
}

export interface CharacterCreationRequest {
  concept: string; // Player's idea for the character
  preferredOccupation?: string;
  preferredBackground?: string;
  preferredSocialClass?: SocialClass;
}

export interface CharacterApprovalAction {
  characterId: string;
  action: 'approve' | 'reject';
  note: string;
  staffUserId: string;
}

// Tipi per il controllo della visibilità dei campi
export interface CharacterVisibilityRules {
  // Campi visibili a tutti
  public: (keyof Character)[];
  // Campi visibili solo ai master
  masterOnly: (keyof Character)[];
}

export const CHARACTER_VISIBILITY: CharacterVisibilityRules = {
  public: [
    'name', 
    'apparentAge', 
    'physicalDescription', 
    'publicDescription'
  ],
  masterOnly: [
    'nationality',
    'birthPlace'
  ]
};

// Interfaccia per il personaggio filtrato in base ai permessi dell'utente
export interface FilteredCharacter extends Partial<Character> {
  // I campi saranno presenti o meno in base ai permessi dell'utente che richiede i dati
}
