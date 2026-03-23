/**
 * Character Creation API Service
 *
 * Handles API calls for character creation configuration, occupations, and skills.
 * All endpoints are PUBLIC (no authentication required).
 *
 * @module lib/api/characterCreation
 * @since 2.0.0
 */

import { api } from './client';

/**
 * Populated skill reference from backend
 */
export interface SkillOption {
  skillId: string;
  name: string;
  category?: string;
  isPlaceholder?: boolean;
  placeholderType?: string;
}

/**
 * Occupation Definition - slot-based skill system
 */
export interface Occupation {
  id: string;
  name: string;
  description: string;
  category: string;
  contacts: string;
  earnings: string;
  image: string | null;
  requiredSkillSlots: Array<{
    options: SkillOption[];
  }>;
  bonusSkills: Array<{
    skillId: string;
    name: string;
    bonusValue: number;
  }>;
}

/**
 * Skill Definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  baseValue: number;
  baseFormula: string | null;
  isPlaceholder?: boolean;
  placeholderType?: string;
}

/**
 * Character Creation Configuration
 */
export interface CharacterCreationConfig {
  occupations: Occupation[];
  skills: Skill[];
  limits: {
    age: { min: number; max: number };
    weight: { min: number; max: number };
    height: { min: number; max: number };
    stats: {
      total: number;
      min: number;
      max: number;
      maxAboveThreshold: { threshold: number; max: number };
    };
    skills: {
      base: number;
      intelligenceFormula: string;
      maxNormal: number;
      maxWithOccupation: number;
    };
  };
  derivedStats: Record<string, { formula: string; description: string }>;
  /**
   * Visibilità dei campi del personaggio.
   * true = pubblico (visibile a tutti), false = privato (solo master/owner).
   * Usato dal wizard per mostrare l'EyeIcon.
   */
  fieldVisibility: Record<string, boolean>;
}

/**
 * Character Creation API
 */
export const characterCreationApi = {
  /**
   * Get Complete Character Creation Configuration
   * Requires: User authentication (auth_token cookie)
   */
  async getConfig(): Promise<CharacterCreationConfig> {
    const response = await api.get<{ data: { config: CharacterCreationConfig } }>(
      '/game/character-creation-config'
    );
    return response.data.config;
  },

  /**
   * Get All Available Occupations
   * Requires: User authentication (auth_token cookie)
   */
  async getOccupations(): Promise<Occupation[]> {
    const response = await api.get<{ data: { occupations: Occupation[] } }>(
      '/game/character-creation-config/occupations'
    );
    return response.data.occupations;
  },

  /**
   * Get All Available Skills
   * Requires: User authentication (auth_token cookie)
   */
  async getSkills(): Promise<Skill[]> {
    const response = await api.get<{ data: { skills: Skill[] } }>(
      '/game/character-creation-config/skills'
    );
    return response.data.skills;
  },
};
