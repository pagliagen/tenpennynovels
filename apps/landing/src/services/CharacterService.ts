/**
 * Character Service
 *
 * Business logic layer for character operations.
 * Provides high-level methods for character management.
 *
 * **Responsibilities**:
 * - Character selection for gameplay
 *
 * **Benefits**:
 * - **Abstraction**: Hides API implementation details
 * - **Reusability**: Single place for character logic
 * - **Type Safety**: Fully typed with TypeScript
 *
 * @module services/CharacterService
 */

import { apiPost } from '@/lib/api/client';
import type { ApiResponse } from '@/types';

/**
 * Character Service Class
 *
 * Provides methods for character-related operations.
 *
 * @class CharacterService
 *
 * @example
 * ```typescript
 * import { characterService } from '@/services/CharacterService';
 *
 * // Select character for gameplay
 * const result = await characterService.selectCharacter('char-uuid-123');
 * ```
 */
export class CharacterService {
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
   *   window.location.href = process.env.NEXT_PUBLIC_GAME_URL;
   * } else {
   *   console.error('Cannot select:', result.error);
   * }
   * ```
   */
  async selectCharacter(characterId: string): Promise<ApiResponse<void>> {
    return apiPost<void>(`/game/characters/${characterId}/select`);
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
