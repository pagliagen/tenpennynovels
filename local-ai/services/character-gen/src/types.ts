export interface SkillDefinition {
  id: string;
  name: string;
  baseValue: number;
  category: string;
  isPlaceholder?: boolean;
}

export interface OccupationDefinition {
  id: string;
  name: string;
  description?: string;
  bonusSkills?: string[];
}

export interface CharacterGenInput {
  requestId: string;
  sessionKey: string;   // NOVO — client-generated UUID, primary key
  description: string;  // Required: character description for LLM
  firstName?: string;   // Optional: will be generated if not provided
  lastName?: string;    // Optional: will be generated if not provided
  gender?: 'male' | 'female' | 'other';  // Optional: will be generated if not provided
}

export type GenStatus = 'queued' | 'processing' | 'complete' | 'error' | 'aborted';

export interface GenEvent {
  generationId: number;
  type: 'state' | 'step' | 'status' | 'restarted' | 'approval_needed' | 'complete' | 'error' | 'aborted';
  data: any;
}

export interface GeneratedStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  appearance: number;
  size: number;
  power: number;
  education: number;
}

/**
 * Breakdown di una singola skill.
 *
 * Rispecchia `SkillBreakdown` del wizard (apps/game/src/types/wizard.ts) con in più
 * `name` denormalizzato per il display. La mappa che lo contiene è SEMPRE keyata
 * per skillId (ObjectId), mai per nome: il wizard scarta le chiavi non-ObjectId.
 */
export interface GeneratedSkill {
  name: string;
  base: number;
  requiredBonus: number;
  manualPoints: number;
  occupationBonus: number;
  total: number;
  category: string;
}

export interface GeneratedBackground {
  briefHistory: string;
  significantEvents: string;
  importantRelationships: string;
  personality: string;
  ideology: string;
  significantPlaces: string;
  fearsAndPhobias: string;
  secrets: string;
  goalsAndMotivations: string;
}

export interface CharacterGenResult {
  requestId: string;
  character: {
    firstName: string;
    lastName: string;
    gender: string;
    birthDate?: string;
    birthPlace?: string;
    age?: number;
    apparentAge?: number;
    height?: number;
    weight?: number;
    eyeColor?: string;
    hairColor?: string;
    visibleMarks?: string;
    hiddenMarks?: string;
    maritalStatus?: string;
    educationTitle?: string;
    criminalRecord?: string;
    pathologies?: string;
    publicDescription?: string;
    privateDescription?: string;
    physicalDescription?: string;
    currentOccupation?: string;
    occupation?: string;
    stats: GeneratedStats;
    /** Keyed by skillId (ObjectId), NON per nome — vedi GeneratedSkill */
    skills: Record<string, GeneratedSkill>;
    dynamicSkills?: Array<{ skillName: string; basedOnTemplate: string; customValue: number; value: number; category: string }>;
    background: GeneratedBackground;
  };
}
