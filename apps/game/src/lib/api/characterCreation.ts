/**
 * Character Creation API Service
 *
 * Handles API calls for character creation configuration, occupations, and skills.
 * All endpoints are PUBLIC (no authentication required).
 *
 * @module lib/api/characterCreation
 * @since 2.0.0
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const GAME_API_URL = `${API_BASE_URL}/game`;

/**
 * Occupation Definition
 */
export interface Occupation {
  id: string;
  name: string;
  description: string;
  category: string;
  socialClass: string;
  contacts: string;
  earnings: string;
  image: string | null;
  requiredSkills: Array<{
    skillId: string;
    name: string;
    bonusValue: number;
  }>;
  bonusSkills: Array<{
    skillId: string;
    name: string;
    bonusValue: number;
  }>;
  alternativeSkills?: Record<string, string[]>;
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
    const response = await axios.get(`${GAME_API_URL}/character-creation-config`, {
      withCredentials: true, // Send cookies with request
    });
    return response.data.data.config;
  },

  /**
   * Get All Available Occupations
   * Requires: User authentication (auth_token cookie)
   */
  async getOccupations(): Promise<Occupation[]> {
    const response = await axios.get(`${GAME_API_URL}/character-creation-config/occupations`, {
      withCredentials: true, // Send cookies with request
    });
    return response.data.data.occupations;
  },

  /**
   * Get All Available Skills
   * Requires: User authentication (auth_token cookie)
   */
  async getSkills(): Promise<Skill[]> {
    const response = await axios.get(`${GAME_API_URL}/character-creation-config/skills`, {
      withCredentials: true, // Send cookies with request
    });
    return response.data.data.skills;
  },
};
