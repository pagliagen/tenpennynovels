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
   * NEW FLOW (Multi-Tab Support):
   * - Backend creates session in Redis (sessionId = opaque UUID)
   * - Frontend saves sessionId to sessionStorage (isolated per tab)
   * - API requests include X-Session-Id header (via interceptor)
   *
   * @param {string} characterId - Character UUID
   * @returns {Promise<ApiResponse<{ sessionId: string }>>} Selection result with sessionId
   *
   * @example
   * ```typescript
   * const result = await characterService.selectCharacter('char-uuid-123');
   *
   * if (result.result && result.data) {
   *   console.log('Character selected! Session:', result.data.sessionId);
   *   // sessionId automatically saved to sessionStorage
   *   window.location.href = process.env.NEXT_PUBLIC_GAME_URL;
   * } else {
   *   console.error('Cannot select:', result.error);
   * }
   * ```
   */
  async selectCharacter(characterId: string): Promise<ApiResponse<{ sessionId: string }>> {
    const response = await apiPost<any>(`/game/characters/${characterId}/select`);

    // NOTE: sessionId is saved to sessionStorage by the calling component (not here)
    // - Manual select: CharacterSelectModal.tsx handleSelectCharacter() saves sessionId
    // This ensures we're always in client-side context (event handlers run post-hydration)

    return response;
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
