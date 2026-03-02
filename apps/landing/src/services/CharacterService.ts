/**
 * Character Service
 *
 * Business logic layer for character operations.
 * Provides high-level methods for character management.
 *
 * **Responsibilities**:
 * - Character creation
 * - Character fetching (list, by ID)
 * - Character selection for gameplay
 * - Occupation management
 *
 * **Benefits**:
 * - **Abstraction**: Hides API implementation details
 * - **Reusability**: Single place for all character logic
 * - **Type Safety**: Fully typed with TypeScript
 * - **Data Sanitization**: Automatic XSS protection
 *
 * @module services/CharacterService
 */

import { apiPost, apiGet } from '@/lib/api/client';
import { sanitizeUserInput, sanitizeRichText } from '@/lib/validation/sanitizers';
import type { ApiResponse, Character, Occupation, CharacterData } from '@/types';

/**
 * Character Service Class
 *
 * Provides methods for all character-related operations.
 *
 * @class CharacterService
 *
 * @example
 * ```typescript
 * import { CharacterService } from '@/services/CharacterService';
 *
 * const characterService = new CharacterService();
 *
 * // Create character
 * const result = await characterService.createCharacter({
 *   name: 'John Watson',
 *   occupation: 'occupation-uuid',
 *   age: 35,
 *   description: 'A skilled doctor...',
 *   background: 'Former military...'
 * });
 * ```
 */
export class CharacterService {
  /**
   * Create new character
   *
   * Creates character with validation and XSS protection.
   * Character status starts as 'draft' and must be approved by master.
   *
   * @param {CharacterData} data - Character creation data
   * @returns {Promise<ApiResponse<Character>>} Created character
   *
   * @example
   * ```typescript
   * const result = await characterService.createCharacter({
   *   name: 'Sherlock Holmes',
   *   occupation: 'detective-uuid',
   *   age: 34,
   *   description: 'Un detective privato dall\'acuta osservazione...',
   *   background: 'Nato a Londra, ha studiato chimica...'
   * });
   *
   * if (result.result && result.data) {
   *   console.log('Character created:', result.data.name);
   *   console.log('Status:', result.data.status); // 'draft'
   * }
   * ```
   */
  async createCharacter(data: CharacterData): Promise<ApiResponse<Character>> {
    // Sanitize inputs (XSS protection)
    const sanitized: CharacterData = {
      name: sanitizeUserInput(data.name),
      occupation: data.occupation, // UUID, no sanitization needed
      currentOccupation: data.currentOccupation
        ? sanitizeUserInput(data.currentOccupation)
        : undefined,
      age: data.age,
      description: data.description
        ? sanitizeRichText(data.description)
        : undefined,
      background: data.background
        ? sanitizeRichText(data.background)
        : undefined,
    };

    return apiPost<Character>('/characters', sanitized);
  }

  /**
   * Get user's characters
   *
   * Fetches all characters belonging to authenticated user.
   * Returns characters sorted by creation date (newest first).
   *
   * @returns {Promise<ApiResponse<Character[]>>} List of user's characters
   *
   * @example
   * ```typescript
   * const result = await characterService.getMyCharacters();
   *
   * if (result.result && result.list) {
   *   console.log('You have', result.list.length, 'characters');
   *   result.list.forEach(char => {
   *     console.log(`- ${char.name} (${char.status})`);
   *   });
   * }
   * ```
   */
  async getMyCharacters(): Promise<ApiResponse<Character[]>> {
    return apiGet<Character[]>('/characters/my');
  }

  /**
   * Get character by ID
   *
   * Fetches single character by ID.
   * Only returns character if it belongs to authenticated user.
   *
   * @param {string} characterId - Character UUID
   * @returns {Promise<ApiResponse<Character>>} Character data
   *
   * @example
   * ```typescript
   * const result = await characterService.getCharacterById('char-uuid-123');
   *
   * if (result.result && result.data) {
   *   console.log('Character:', result.data.name);
   *   console.log('Occupation:', result.data.occupationDetails?.name);
   * }
   * ```
   */
  async getCharacterById(characterId: string): Promise<ApiResponse<Character>> {
    return apiGet<Character>(`/characters/${characterId}`);
  }

  /**
   * Select character for gameplay
   *
   * Sets character as active for gameplay session.
   * Only approved characters can be selected.
   *
   * @param {string} characterId - Character UUID
   * @returns {Promise<ApiResponse<void>>} Selection result
   *
   * @example
   * ```typescript
   * const result = await characterService.selectCharacter('char-uuid-123');
   *
   * if (result.result) {
   *   console.log('Character selected for play!');
   *   router.push('/game');
   * } else {
   *   console.error('Cannot select:', result.error);
   * }
   * ```
   */
  async selectCharacter(characterId: string): Promise<ApiResponse<void>> {
    return apiPost<void>('/characters/select', { characterId });
  }

  /**
   * Get available occupations
   *
   * Fetches list of all available occupations for character creation.
   * Occupations are categorized (e.g., Sanità, Commercio, Arte).
   *
   * @returns {Promise<ApiResponse<Occupation[]>>} List of occupations
   *
   * @example
   * ```typescript
   * const result = await characterService.getOccupations();
   *
   * if (result.result && result.list) {
   *   console.log('Available occupations:');
   *   result.list.forEach(occ => {
   *     console.log(`- ${occ.name} (${occ.category})`);
   *   });
   * }
   * ```
   */
  async getOccupations(): Promise<ApiResponse<Occupation[]>> {
    return apiGet<Occupation[]>('/occupations');
  }

  /**
   * Get occupation by ID
   *
   * Fetches single occupation details.
   *
   * @param {string} occupationId - Occupation UUID
   * @returns {Promise<ApiResponse<Occupation>>} Occupation data
   *
   * @example
   * ```typescript
   * const result = await characterService.getOccupationById('occ-uuid-123');
   *
   * if (result.result && result.data) {
   *   console.log('Occupation:', result.data.name);
   *   console.log('Description:', result.data.description);
   * }
   * ```
   */
  async getOccupationById(occupationId: string): Promise<ApiResponse<Occupation>> {
    return apiGet<Occupation>(`/occupations/${occupationId}`);
  }

  /**
   * Update character (draft only)
   *
   * Updates character fields.
   * Only draft characters can be edited by user.
   *
   * @param {string} characterId - Character UUID
   * @param {Partial<CharacterData>} updates - Fields to update
   * @returns {Promise<ApiResponse<Character>>} Updated character
   *
   * @example
   * ```typescript
   * const result = await characterService.updateCharacter('char-uuid-123', {
   *   description: 'Updated description...',
   *   age: 36
   * });
   *
   * if (result.result && result.data) {
   *   console.log('Character updated:', result.data.name);
   * }
   * ```
   */
  async updateCharacter(
    characterId: string,
    updates: Partial<CharacterData>
  ): Promise<ApiResponse<Character>> {
    // Sanitize inputs
    const sanitized: Partial<CharacterData> = {};

    if (updates.name !== undefined) {
      sanitized.name = sanitizeUserInput(updates.name);
    }

    if (updates.currentOccupation !== undefined) {
      sanitized.currentOccupation = sanitizeUserInput(updates.currentOccupation);
    }

    if (updates.description !== undefined) {
      sanitized.description = sanitizeRichText(updates.description);
    }

    if (updates.background !== undefined) {
      sanitized.background = sanitizeRichText(updates.background);
    }

    if (updates.occupation !== undefined) {
      sanitized.occupation = updates.occupation;
    }

    if (updates.age !== undefined) {
      sanitized.age = updates.age;
    }

    return apiPost<Character>(`/characters/${characterId}`, sanitized);
  }

  /**
   * Delete character (draft only)
   *
   * Deletes character.
   * Only draft characters can be deleted by user.
   *
   * @param {string} characterId - Character UUID
   * @returns {Promise<ApiResponse<void>>} Deletion result
   *
   * @example
   * ```typescript
   * const result = await characterService.deleteCharacter('char-uuid-123');
   *
   * if (result.result) {
   *   console.log('Character deleted');
   * }
   * ```
   */
  async deleteCharacter(characterId: string): Promise<ApiResponse<void>> {
    return apiPost<void>(`/characters/${characterId}/delete`);
  }
}

/**
 * Singleton instance of CharacterService
 *
 * Export a single instance to be shared across the application.
 *
 * @constant
 * @type {CharacterService}
 */
export const characterService = new CharacterService();
