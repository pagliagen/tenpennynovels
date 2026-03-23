/**
 * Game State Store (Zustand)
 *
 * Manages runtime gameplay state including:
 * - Current location (where the character currently is)
 * - Future: Current campaign, current quest, etc.
 *
 * CRITICAL: This store handles ONLY runtime gameplay state.
 * Identity state (user, character) is handled by AuthStore.
 * Resource data (locations list) is handled by LocationStore.
 * Real-time data (presence) is handled by PresenceStore.
 *
 * @module store/gameStateStore
 * @since 3.0.0
 */

import { create } from 'zustand';

import { locationsApi } from '@/lib/api/locations';
import { wsClient } from '@/lib/websocket/client';

/**
 * Game State Store State
 *
 * @interface GameStateStore
 * @since 3.0.0
 *
 * @property {string | null} currentLocationId - Current location ID (null = London/no location)
 * @property {string | null} currentLocationName - Current location name for display
 */
interface GameStateStore {
  // State
  currentLocationId: string | null;
  currentLocationName: string | null;

  // Actions
  enterLocation: (locationId: string, locationName: string) => Promise<void>;
  leaveLocation: () => Promise<void>;

  // Internal
  _setLocation: (id: string | null, name: string | null) => void;
  reset: () => void;
}

/**
 * Game State Store Hook
 *
 * Zustand store for managing runtime gameplay state.
 * NOT persisted to localStorage (ephemeral by nature).
 *
 * @constant
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<GameStateStore>>}
 * @since 3.0.0
 *
 * @example
 * ```typescript
 * // In a component
 * const { enterLocation, leaveLocation } = useGameStateStore();
 *
 * // Enter location
 * await enterLocation('location-id-123', 'Parliament Square');
 *
 * // Leave location
 * await leaveLocation();
 *
 * // Read current location
 * const currentLocationId = useGameStateStore((state) => state.currentLocationId);
 * ```
 */
export const useGameStateStore = create<GameStateStore>((set, get) => ({
  // Initial state
  currentLocationId: null,
  currentLocationName: null,

  /**
   * Enter a location (SINGLE POINT OF WRITE)
   *
   * Handles:
   * 1. Local state update (optimistic)
   * 2. Backend persistence (HTTP)
   * 3. WebSocket room join
   *
   * @function enterLocation
   * @param {string} locationId - Location ID to enter
   * @param {string} locationName - Location name for display
   * @returns {Promise<void>}
   * @throws {Error} If backend or WebSocket fails (with rollback)
   * @since 3.0.0
   */
  enterLocation: async (locationId: string, locationName: string) => {
    try {
      // 1. Optimistic update (set local state first)
      set({ currentLocationId: locationId, currentLocationName: locationName });
      console.log('[GameState] 🔄 Entering location:', locationName);

      // 2. Persist to backend (HTTP)
      await locationsApi.enter(locationId);
      console.log('[GameState] ✅ Backend persisted');

      // 3. Join WebSocket room
      wsClient.joinLocation(locationId);
      console.log('[GameState] ✅ WebSocket room joined');
    } catch (error) {
      console.error('[GameState] ❌ Enter failed, rolling back:', error);
      // Rollback on error (clear location state)
      set({ currentLocationId: null, currentLocationName: null });
      throw error;
    }
  },

  /**
   * Leave current location
   *
   * Handles:
   * 1. Clear local state
   * 2. WebSocket room leave
   * 3. Backend cleanup (optional - handled by WebSocket disconnect)
   *
   * @function leaveLocation
   * @returns {Promise<void>}
   * @since 3.0.0
   */
  leaveLocation: async () => {
    const { currentLocationId } = get();
    if (!currentLocationId) {
      console.log('[GameState] ⏭️ No location to leave');
      return;
    }

    try {
      console.log('[GameState] 🔄 Leaving location:', currentLocationId);

      // 1. Emit WebSocket leave (BEFORE clearing state, needs currentLocationId)
      wsClient.leaveLocation(currentLocationId);

      // 2. Clear local state
      set({ currentLocationId: null, currentLocationName: null });

      // 3. Backend cleanup (optional - WebSocket disconnect handler cleans up)
      // await locationsApi.leave();

      console.log('[GameState] ✅ Left location');
    } catch (error) {
      console.error('[GameState] ❌ Leave failed:', error);
      throw error;
    }
  },

  /**
   * Internal setter (for direct updates from WebSocket events)
   *
   * Used by WebSocket context to update location state when server broadcasts changes.
   * Not intended for direct component use - use enterLocation() instead.
   *
   * @function _setLocation
   * @param {string | null} id - Location ID (null to clear)
   * @param {string | null} name - Location name (null to clear)
   * @returns {void}
   * @since 3.0.0
   */
  _setLocation: (id: string | null, name: string | null) => {
    set({ currentLocationId: id, currentLocationName: name });
  },

  /**
   * Reset store to initial state
   *
   * Clears all runtime gameplay state.
   * Called on logout to ensure clean state.
   *
   * @function reset
   * @returns {void}
   * @since 3.0.0
   */
  reset: () => {
    console.log('[GameState] 🔄 Resetting store');
    set({ currentLocationId: null, currentLocationName: null });
  },
}));

/**
 * Selector Hooks for Optimized Re-renders
 *
 * Use these instead of destructuring from useGameStateStore()
 * to prevent unnecessary re-renders.
 *
 * @namespace gameStateSelectors
 * @since 3.0.0
 *
 * @example
 * ```typescript
 * // BAD: Component re-renders on ANY game state change
 * const { currentLocationId, currentLocationName } = useGameStateStore();
 *
 * // GOOD: Component re-renders ONLY when currentLocationId changes
 * const currentLocationId = useGameStateStore((state) => state.currentLocationId);
 * ```
 */
export const gameStateSelectors = {
  /**
   * Select current location ID
   *
   * @param {GameStateStore} state - Store state
   * @returns {string | null}
   */
  currentLocationId: (state: GameStateStore) => state.currentLocationId,

  /**
   * Select current location name
   *
   * @param {GameStateStore} state - Store state
   * @returns {string | null}
   */
  currentLocationName: (state: GameStateStore) => state.currentLocationName,

  /**
   * Check if character is in a location
   *
   * @param {GameStateStore} state - Store state
   * @returns {boolean}
   */
  isInLocation: (state: GameStateStore) => state.currentLocationId !== null,
} as const;
