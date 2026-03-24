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
  character: {
    firstName: string;
    lastName: string;
    gender: 'male' | 'female' | 'other';
    description: string;
  };
  gameConfig: {
    skills: SkillDefinition[];
    occupations: OccupationDefinition[];
    statsBudget?: number;
    skillsBudget?: number;
  };
  callback?: {
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    headers: Record<string, string>;
  };
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
    skills: Record<string, number>;
    dynamicSkills?: Array<{ skillName: string; basedOnTemplate: string; customValue: number; value: number; category: string }>;
    background: GeneratedBackground;
  };
}
