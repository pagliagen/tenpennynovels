/**
 * Character API Service
 *
 * Handles all HTTP API calls related to character operations.
 * Uses the singleton apiClient for consistent auth and error handling.
 *
 * **Endpoints**:
 * - POST /game/characters - Create new character (status: DRAFT)
 * - GET /game/characters/:id - Get character by ID
 * - PUT /game/characters/:id - Update character
 * - POST /game/characters/:id/submit - Submit for approval (DRAFT → PENDING_APPROVAL)
 * - DELETE /game/characters/:id - Delete character
 *
 * @module lib/api/character
 * @since 2.0.0
 */

import type { Character } from '@/types/api/schemas';
import type { OccupationData, SkillDefinition } from '@/types/game';
import type { CharacterCreatePayload } from '@/types/wizard';

import { api } from './client';

/**
 * Character API Response Wrappers
 */
interface CharacterResponse {
  character: Character;
}

interface CharactersListResponse {
  characters: Character[];
  total: number;
}

export interface CharacterCreationConfig {
  stats: {
    totalPoints: number;
    minValue: number;
    maxStatsAbove80: number;
    creationCap: number;
    gameplayCap: number;
  };
  skills: {
    totalPoints: number;
    /** EDU x N formula (e.g. "EDUx4"), pool spendable ONLY on occupation skills */
    occupationPointsFormula?: string;
    /** INT x N formula (e.g. "INTx2"), pool spendable ONLY on non-occupation skills */
    hobbyPointsFormula?: string;
    creationCap: number;
    creationCapWithOccupation: number;
  };
  occupation: any;
  limits: {
    age: { min: number; max: number };
    weight: { min: number; max: number; unit: string };
    height: { min: number; max: number; unit: string };
    backgroundFields: {
      briefHistory:           { minChar: number; maxChar: number };
      significantEvents:      { minChar: number; maxChar: number };
      importantRelationships: { minChar: number; maxChar: number };
      personality:            { minChar: number; maxChar: number };
      ideology:               { minChar: number; maxChar: number };
    };
  };
  socialClasses: any[];
  formulas: any;
  /**
   * Visibilità dei campi del personaggio.
   * true = pubblico (visibile a tutti), false = privato (solo master/owner).
   */
  fieldVisibility?: Record<string, boolean>;
}

interface CreationConfigResponse {
  statsConfig: CharacterCreationConfig['stats'];
  skillsConfig: CharacterCreationConfig['skills'];
  occupation: any;
  limits: CharacterCreationConfig['limits'];
  socialClasses: any[];
  formulas: any;
  derivedStats: any;
  occupations: any[];
  skills: any[];
  fieldVisibility?: Record<string, boolean>;
}

/**
 * Character API Service
 *
 * Service layer for character CRUD operations.
 */
export const characterApi = {
  /**
   * Create Character
   *
   * Creates a new character with status DRAFT.
   * Character must go through wizard (6 steps) to complete.
   *
   * **Flow**:
   * 1. Create character (status: DRAFT)
   * 2. User completes wizard
   * 3. Call submitForApproval() (status: DRAFT → PENDING_APPROVAL)
   * 4. Staff approves (status: PENDING_APPROVAL → APPROVED)
   *
   * @param {CharacterCreatePayload} data - Complete character data
   * @returns {Promise<Character>} Created character
   * @throws {ApiError} If validation fails or request fails
   *
   * @example
   * ```typescript
   * const character = await characterApi.create({
   *   name: 'Lord Arthur Pemberton',
   *   birthplace: 'London',
   *   age: 35,
   *   stats: { strength: 65, dexterity: 70, ... },
   *   skills: { accounting: 40, anthropology: 15, ... },
   *   occupation: 'detective',
   *   // ... all other fields
   * });
   * // character.playerStatus === 'draft'
   * ```
   */
  async create(data: CharacterCreatePayload): Promise<Character> {
    const response = await api.post<{ data: CharacterResponse }>('/game/characters', data);
    return response.data.character;
  },

  /**
   * Get Character by ID
   *
   * Fetches complete character data including stats, skills, background.
   * Requires game:character:read (draft characters do not have it; use getForWizard for draft).
   *
   * @param {string} characterId - Character ID
   * @returns {Promise<Character>} Character data
   * @throws {ApiError} If character not found or request fails
   *
   * @example
   * ```typescript
   * const character = await characterApi.getById('abc123');
   * logger.info(`${character.name} - ${character.occupation}`);
   * ```
   */
  async getById(characterId: string): Promise<Character> {
    const response = await api.get<{ data: CharacterResponse }>(`/game/characters/${characterId}`);
    return response.data.character;
  },

  /**
   * Get Character for Wizard (draft editing)
   *
   * Fetches character data for the wizard. Requires game:character:wizard (only draft).
   * Only the current character can be loaded.
   *
   * @param {string} characterId - Character ID (must be selected character)
   * @returns {Promise<Character>} Character data for wizard
   */
  async getForWizard(characterId: string): Promise<Character> {
    const response = await api.get<{ data: CharacterResponse }>(`/game/characters/${characterId}/wizard`);
    return response.data.character;
  },

  /**
   * Update Character
   *
   * Updates character fields.
   * Only DRAFT or APPROVED characters can be edited.
   * PENDING_APPROVAL and DELETED characters cannot be modified.
   *
   * **Partial Updates**: Only send fields to update.
   *
   * @param {string} characterId - Character ID
   * @param {Partial<CharacterCreatePayload>} data - Fields to update
   * @returns {Promise<Character>} Updated character
   * @throws {ApiError} If validation fails, character locked, or request fails
   *
   * @example
   * ```typescript
   * // Update only age and height
   * const updated = await characterApi.update('abc123', {
   *   age: 36,
   *   height: "5'11\""
   * });
   * ```
   */
  async update(
    characterId: string,
    data: Record<string, any>
  ): Promise<Character> {
    const response = await api.put<{ data: CharacterResponse }>(
      `/game/characters/${characterId}`,
      data
    );
    return response.data.character;
  },

  /**
   * Submit for Approval
   *
   * Submits character for staff approval.
   * Transitions status: DRAFT → PENDING_APPROVAL.
   *
   * **Validation**: Backend validates all required fields before accepting.
   * If validation fails, character remains DRAFT.
   *
   * **Post-Submission**: Character becomes read-only until staff approves/rejects.
   *
   * @param {string} characterId - Character ID
   * @returns {Promise<Character>} Updated character (playerStatus: 'pending')
   * @throws {ApiError} If validation fails, character not draft, or request fails
   *
   * @example
   * ```typescript
   * // After completing wizard Step 6
   * const character = await characterApi.submitForApproval('abc123');
   * // character.playerStatus === 'pending'
   * ```
   */
  async submitForApproval(characterId: string): Promise<Character> {
    const response = await api.post<{ data: CharacterResponse }>(
      `/game/characters/${characterId}/submit`,
      {}
    );
    return response.data.character;
  },

  /**
   * Delete Character
   *
   * Soft-deletes a character (sets status to DELETED).
   * Character data is preserved but no longer accessible.
   *
   * **Restrictions**: Cannot delete APPROVED characters in active campaigns.
   *
   * @param {string} characterId - Character ID
   * @returns {Promise<void>}
   * @throws {ApiError} If character locked or request fails
   *
   * @example
   * ```typescript
   * await characterApi.delete('abc123');
   * ```
   */
  async delete(characterId: string): Promise<void> {
    await api.delete(`/game/characters/${characterId}`);
  },

  /**
   * List User's Characters
   *
   * Fetches all characters belonging to current user.
   * Includes all statuses (DRAFT, PENDING_APPROVAL, APPROVED, DELETED).
   *
   * @param {Object} [options] - Query options
   * @param {string} [options.status] - Filter by status
   * @param {number} [options.limit=50] - Max characters to fetch
   * @param {number} [options.offset=0] - Pagination offset
   * @returns {Promise<CharactersListResponse>} Characters list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * // Get all characters
   * const all = await characterApi.list();
   *
   * // Get only APPROVED characters
   * const approved = await characterApi.list({ status: 'APPROVED' });
   * ```
   */
  async list(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<CharactersListResponse> {
    const response = await api.get<{ data: CharactersListResponse }>('/game/characters', {
      params: options,
    });
    return response.data;
  },

  /**
   * Get Character Creation Config
   *
   * Fetches character creation rules from backend (dynamic from SystemConfiguration).
   * Includes: stats budget (450), stat minimum (20), skills budget (250), formulas.
   *
   * @returns {Promise<CharacterCreationConfig>} Character creation config
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const config = await characterApi.getCreationConfig();
   * logger.info(`Stats budget: ${config.stats.totalPoints}`); // 450
   * logger.info(`Skills budget: ${config.skills.totalPoints}`); // 250
   * ```
   */
  async getCreationConfig(): Promise<CharacterCreationConfig> {
    const response = await api.get<{ data: { config: CreationConfigResponse } }>(
      '/game/character-creation-config'
    );
    const c = response.data.config;
    return {
      stats: c.statsConfig,
      skills: c.skillsConfig,
      occupation: c.occupation,
      limits: c.limits,
      socialClasses: c.socialClasses,
      formulas: c.formulas,
      fieldVisibility: c.fieldVisibility,
    };
  },

  /**
   * Get Occupations List
   *
   * Fetches available occupations for character creation.
   * Each occupation has required skills (6) and bonus skills (1).
   *
   * **Note**: This endpoint might not exist yet.
   * Fallback: Use static config or hardcode occupations in frontend.
   *
   * @returns {Promise<Occupation[]>} Occupations list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const occupations = await characterApi.getOccupations();
   * const detective = occupations.find(o => o.name === 'Detective');
   * logger.info(detective.requiredSkillSlots); // [{options: [{skillId, name}, ...]}, ...]
   * ```
   */
  async getOccupations(): Promise<OccupationData[]> {
    const response = await api.get<{ occupations: OccupationData[] }>('/game/occupations');
    return response.occupations;
  },

  /**
   * Get Skills List
   *
   * Fetches all available skills with base values and categories.
   * Used for wizard Step 4 skill allocation.
   *
   * @returns {Promise<SkillDefinition[]>} Skills list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const skills = await characterApi.getSkills();
   * const accounting = skills.find(s => s.name === 'Accounting');
   * logger.info(`${accounting.name}: ${accounting.base}%`); // Accounting: 15%
   * ```
   */
  async getSkills(): Promise<SkillDefinition[]> {
    const response = await api.get<{ skills: SkillDefinition[] }>('/game/skills');
    return response.skills;
  },

  /**
   * Search Face Claims
   *
   * Real-time validation endpoint for prestavolto field.
   * Returns exact match, fuzzy matches, and complete list of existing face claims.
   *
   * **Use Case**: Debounced validation in wizard Step 1 (prestavolto input).
   *
   * @param {string} query - Search query (e.g., "Tom Hiddleston")
   * @returns {Promise<FaceClaimSearchResult>} Search results
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const result = await characterApi.searchFaceClaims('Tom Hiddleston');
   * if (result.exactMatch) {
   *   logger.info('⚠️ Already used by:', { characterName: result.exactMatch.characterName });
   * }
   * ```
   */
  async searchFaceClaims(query: string): Promise<{
    exactMatch: { characterName: string; status: string } | null;
    matches: Array<{ prestavolto: string; characterName: string; status: string }>;
    allFaceClaims: Array<{
      prestavolto: string;
      characterName: string;
      characterId: string;
      playerStatus: string;
      prestavoltoApprovedAt: Date | null;
    }>;
  }> {
    const response = await api.get<{
      data: {
        exactMatch: { characterName: string; status: string } | null;
        matches: Array<{ prestavolto: string; characterName: string; status: string }>;
        allFaceClaims: Array<{
          prestavolto: string;
          characterName: string;
          characterId: string;
          playerStatus: string;
          prestavoltoApprovedAt: Date | null;
        }>;
      };
    }>('/game/characters/face-claims/search', {
      params: { q: query }
    });
    return response.data;
  },

  /**
   * Update Prestavolto
   *
   * Dedicated endpoint for updating character's face claim.
   * Works even for approved characters.
   * Requires staff approval for changes.
   *
   * @param characterId - Character ID
   * @param prestavolto - New face claim name
   * @returns Updated prestavolto info with approval status
   */
  async updatePrestavolto(characterId: string, prestavolto: string): Promise<{
    prestavolto: string;
    prestavoltoStatus: string | null;
    isFirstAssignment: boolean;
    isChange: boolean;
    requiresApproval: boolean;
    hasDuplicate: boolean;
    duplicateCharacter: string | null;
  }> {
    const response = await api.put<{
      prestavolto: string;
      prestavoltoStatus: string | null;
      isFirstAssignment: boolean;
      isChange: boolean;
      requiresApproval: boolean;
      hasDuplicate: boolean;
      duplicateCharacter: string | null;
    }>(`/game/characters/${characterId}/prestavolto`, { prestavolto });
    return response;
  },
};
