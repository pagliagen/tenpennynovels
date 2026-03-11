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

import { api } from './client';
import type { Character } from '@/types/api/schemas';
import type { CharacterCreatePayload } from '@/types/wizard';

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
   * // character.status === 'DRAFT'
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
   * console.log(`${character.name} - ${character.occupation}`);
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
    data: Partial<CharacterCreatePayload>
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
   * @returns {Promise<Character>} Updated character (status: PENDING_APPROVAL)
   * @throws {ApiError} If validation fails, character not DRAFT, or request fails
   *
   * @example
   * ```typescript
   * // After completing wizard Step 6
   * const character = await characterApi.submitForApproval('abc123');
   * // character.status === 'PENDING_APPROVAL'
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
   * Fetches character creation rules from backend.
   * Includes: stats budget (400), skills formula (200+INT/2), occupation config, formulas.
   *
   * **Config Location**: `/services/unified-backend/src/config/static/character-creation.json`
   *
   * @returns {Promise<CharacterCreationConfig>} Character creation config
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const config = await characterApi.getCreationConfig();
   * console.log(`Stats budget: ${config.stats.totalPoints}`); // 400
   * console.log(`Skills formula: ${config.skills.totalPointsFormula}`); // "constant:200"
   * ```
   */
  async getCreationConfig(): Promise<any> {
    // TODO: Add proper type from wizard.ts
    const response = await api.get<any>('/game/config/character-creation');
    return response;
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
   * console.log(detective.requiredSkillSlots); // [{options: [{skillId, name}, ...]}, ...]
   * ```
   */
  async getOccupations(): Promise<any[]> {
    // TODO: Add proper Occupation type from wizard.ts
    const response = await api.get<{ occupations: any[] }>('/game/occupations');
    return response.occupations;
  },

  /**
   * Get Skills List
   *
   * Fetches all available skills with base values and categories.
   * Used for wizard Step 4 skill allocation.
   *
   * **Note**: This endpoint might not exist yet.
   * Fallback: Use static config or hardcode skills in frontend.
   *
   * @returns {Promise<SkillDefinition[]>} Skills list
   * @throws {ApiError} If request fails
   *
   * @example
   * ```typescript
   * const skills = await characterApi.getSkills();
   * const accounting = skills.find(s => s.name === 'Accounting');
   * console.log(`${accounting.name}: ${accounting.base}%`); // Accounting: 15%
   * ```
   */
  async getSkills(): Promise<any[]> {
    // TODO: Add proper SkillDefinition type from wizard.ts
    const response = await api.get<{ skills: any[] }>('/game/skills');
    return response.skills;
  },
};

/**
 * Re-export for backward compatibility
 */
export default characterApi;
