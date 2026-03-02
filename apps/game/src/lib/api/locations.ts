/**
 * Location API Client
 *
 * HTTP endpoints for location persistence layer.
 * Updates database (character.currentLocation, location.occupants).
 *
 * **Dual-Layer Architecture**:
 * - This API client handles HTTP persistence (DB updates)
 * - WebSocket join_location handles real-time (Socket.IO rooms)
 * - Both are called in sequence from chat page
 *
 * @module lib/api/locations
 * @since 2.0.0
 */

import { api } from './client';

/**
 * Location API Response Types
 */
export interface EnterLocationResponse {
  location: {
    id: string;
    name: string;
    description: string;
    occupants: number;
    occupantsList: Array<{
      characterId: string;
      characterName: string;
      enteredAt: string;
      lastSeen: string;
    }>;
    hasShop: boolean;
    private: boolean;
  };
}

export interface LeaveLocationResponse {
  characterId: string;
  currentLocation: null;
  locationName: string;
  previousLocation: string | null;
  timestamp: string;
}

/**
 * Location API client for HTTP persistence layer
 */
export const locationsApi = {
  /**
   * Enter Location - Updates DB (character.currentLocation, location.occupants)
   *
   * **Layer 1 (Persistence)**: Updates MongoDB documents atomically.
   * Call this BEFORE emitting WebSocket join_location event.
   *
   * @param {string} locationId - MongoDB ObjectId of location
   * @returns {Promise<EnterLocationResponse>} Location data with occupants
   * @throws {ApiError} If location not found (404) or access denied (403)
   *
   * @example
   * ```typescript
   * // In chat page useEffect
   * await locationsApi.enter(location._id);
   * socket.emit('join_location', location._id);
   * ```
   */
  async enter(locationId: string): Promise<EnterLocationResponse> {
    return api.post(`/game/locations/${locationId}/enter`, {});
  },

  /**
   * Leave Location - Cleans DB (character.currentLocation = null, remove from occupants)
   *
   * **NOTE**: For unmount cleanup, emit WebSocket leave_location instead.
   * WebSocket disconnect handler cleans DB automatically on crash/close tab.
   *
   * Use this endpoint only for explicit user-initiated leave actions.
   *
   * @returns {Promise<LeaveLocationResponse>} Leave confirmation
   *
   * @example
   * ```typescript
   * // Explicit leave button click
   * await locationsApi.leave();
   *
   * // NOT for unmount cleanup - use WebSocket instead:
   * socket.emit('leave_location', locationId);
   * ```
   */
  async leave(): Promise<LeaveLocationResponse> {
    return api.post('/game/locations/leave');
  }
};
