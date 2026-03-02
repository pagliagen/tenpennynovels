/**
 * Presence Store (Zustand)
 *
 * Manages online presence state for all characters including:
 * - Global presence list (all online characters)
 * - Location-filtered presence (characters in same location)
 * - Real-time updates via WebSocket events
 *
 * CRITICAL: This store handles real-time presence data.
 * WebSocket subscriptions are managed by usePresence() hook.
 *
 * @module store/presenceStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { api } from '@/lib/api/client';

/**
 * Global Presence Data Structure
 *
 * Matches backend LocationService.getGlobalPresence() response
 *
 * @interface GlobalPresence
 * @since 2.0.0
 *
 * @property {string} characterId - Character ID
 * @property {string} characterName - Character name
 * @property {string | null} characterSurname - Character surname (optional)
 * @property {string} locationId - Current location ID (empty string = London)
 * @property {string} locationName - Location name or "STANZA PRIVATA" for private locations
 * @property {boolean} isCurrentCharacter - Whether this is the requesting character
 * @property {string | null} avatar - Avatar URL (optional)
 */
export interface GlobalPresence {
  characterId: string;
  characterName: string;
  characterSurname: string | null;
  locationId: string;
  locationName: string;
  isCurrentCharacter: boolean;
  avatar: string | null;
}

/**
 * Presence Store State
 *
 * @interface PresenceState
 * @since 2.0.0
 *
 * @property {GlobalPresence[]} globalPresence - All online characters
 * @property {Date | null} lastUpdated - Timestamp of last API fetch
 * @property {boolean} isLoading - Whether initial fetch is in progress
 * @property {string | null} error - Error message if fetch failed
 */
interface PresenceState {
  globalPresence: GlobalPresence[];
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Presence Store Actions
 *
 * @interface PresenceActions
 * @since 2.0.0
 */
interface PresenceActions {
  /**
   * Initialize presence store with API fetch
   *
   * Called once on app mount to fetch initial presence data.
   *
   * @param {string} characterId - Current character ID
   * @returns {Promise<void>}
   */
  initialize: (characterId: string) => Promise<void>;

  /**
   * Handle player_entered event (location-scoped)
   *
   * Optimistically adds character to global presence list.
   * If character already exists, updates their location.
   *
   * @param {object} event - player_entered event data
   * @returns {void}
   */
  handlePlayerEntered: (event: {
    characterId: string;
    characterName: string;
    locationId: string;
    timestamp: string;
  }) => void;

  /**
   * Handle player_left event (location-scoped)
   *
   * Updates character's location to null (London) in presence list.
   *
   * @param {object} event - player_left event data
   * @returns {void}
   */
  handlePlayerLeft: (event: {
    characterId: string;
    characterName?: string;
    locationId?: string;
    timestamp: string;
  }) => void;

  /**
   * Handle global_presence_update event
   *
   * Updates character's location based on character_moved broadcast.
   *
   * @param {object} event - global_presence_update event data
   * @returns {void}
   */
  handleGlobalPresenceUpdate: (event: {
    type: 'character_moved' | 'character_entered_location' | 'character_left_location';
    characterId: string;
    characterName: string;
    oldLocationId?: string;
    newLocationId?: string;
    locationId?: string;
    locationName?: string;
    timestamp: string;
  }) => void;

  /**
   * Handle user_status_change event
   *
   * Adds/removes character from global presence when going online/offline.
   *
   * @param {object} event - user_status_change event data
   * @returns {void}
   */
  handleUserStatusChange: (event: {
    userId: string;
    username: string;
    status: 'online' | 'offline';
    timestamp: string;
  }) => void;

  /**
   * Get location-filtered presence
   *
   * Returns only characters in the specified location.
   * Computed on-demand, not stored in state.
   *
   * @param {string | null} locationId - Location ID (null = London)
   * @returns {GlobalPresence[]} Characters in this location
   */
  getLocationPresence: (locationId: string | null) => GlobalPresence[];

  /**
   * Reset store to initial state
   *
   * Used on logout or character switch.
   *
   * @returns {void}
   */
  reset: () => void;
}

/**
 * Initial State
 */
const initialState: PresenceState = {
  globalPresence: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
};

/**
 * Presence Store (Zustand)
 *
 * @example
 * ```typescript
 * const { globalPresence, getLocationPresence, initialize } = usePresenceStore();
 *
 * // Initialize on mount
 * useEffect(() => {
 *   initialize(characterId);
 * }, [characterId]);
 *
 * // Get location-filtered presence
 * const locationPresence = getLocationPresence(currentLocation?.id);
 * ```
 */
export const usePresenceStore = create<PresenceState & PresenceActions>((set, get) => ({
  // State
  ...initialState,

  // Actions
  initialize: async (_characterId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Fetch global presence from backend
      // Backend returns: { result: boolean, data: { globalPresence: GlobalPresence[] } }
      const response = await api.get<{ result: boolean; data: { globalPresence: GlobalPresence[] } }>('/game/presence');

      if (response.result && response.data) {
        // Backend returns { data: { globalPresence: [...] } }
        // Extract the actual array from the nested structure
        const responseData = response.data as any;
        const presenceArray = responseData.globalPresence || [];

        if (!Array.isArray(presenceArray)) {
          console.error('❌ initialize: presenceArray is not an array!', presenceArray);
          throw new Error('API response data.globalPresence is not an array');
        }

        set({
          globalPresence: presenceArray,
          lastUpdated: new Date(),
          isLoading: false,
          error: null,
        });
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error: any) {
      console.error('Failed to fetch global presence:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch presence data',
      });
    }
  },

  handlePlayerEntered: (event) => {
    const { globalPresence } = get();

    // Check if character already exists in presence list
    const existingIndex = globalPresence.findIndex(
      (p) => p.characterId === event.characterId
    );

    if (existingIndex !== -1) {
      // Update existing character's location
      const updated = [...globalPresence];
      const existing = updated[existingIndex];
      if (existing) {
        updated[existingIndex] = {
          ...existing,
          locationId: event.locationId,
          locationName: existing.locationName, // Keep existing name (may be "STANZA PRIVATA")
        };
      }
      set({ globalPresence: updated });
    } else {
      // Add new character to presence list
      set({
        globalPresence: [
          ...globalPresence,
          {
            characterId: event.characterId,
            characterName: event.characterName,
            characterSurname: null,
            locationId: event.locationId,
            locationName: 'Unknown Location', // Will be updated by global_presence_update
            isCurrentCharacter: false,
            avatar: null,
          },
        ],
      });
    }
  },

  handlePlayerLeft: (event) => {
    const { globalPresence } = get();

    // Update character's location to null (London)
    const updated = globalPresence.map((p) =>
      p.characterId === event.characterId
        ? { ...p, locationId: '', locationName: 'London' }
        : p
    );

    set({ globalPresence: updated });
  },

  handleGlobalPresenceUpdate: (event) => {
    const { globalPresence } = get();

    if (event.type === 'character_moved') {
      // Character moved between locations
      const updated = globalPresence.map((p) =>
        p.characterId === event.characterId
          ? {
              ...p,
              locationId: event.newLocationId || '',
              locationName: event.locationName || 'London',
            }
          : p
      );
      set({ globalPresence: updated });
    } else if (event.type === 'character_entered_location') {
      // Character entered a location (from London or another location)
      const updated = globalPresence.map((p) =>
        p.characterId === event.characterId
          ? {
              ...p,
              locationId: event.locationId || '',
              locationName: event.locationName || 'Unknown Location',
            }
          : p
      );
      set({ globalPresence: updated });
    } else if (event.type === 'character_left_location') {
      // Character left location (returned to London)
      const updated = globalPresence.map((p) =>
        p.characterId === event.characterId
          ? { ...p, locationId: '', locationName: 'London' }
          : p
      );
      set({ globalPresence: updated });
    }
  },

  handleUserStatusChange: (event) => {
    // TODO: Implement when backend sends characterId in user_status_change event
    // Current implementation: user_status_change doesn't include character data
    // Frontend will rely on API refetch or character_moved events for now
    console.log('user_status_change event received (not fully implemented):', event);
  },

  getLocationPresence: (locationId) => {
    const state = get();

    // Debug logging
    // Defensive: handle nested structure bug (if globalPresence is {globalPresence: []})
    let globalPresence: GlobalPresence[];
    if (Array.isArray(state.globalPresence)) {
      globalPresence = state.globalPresence;
    } else if (state.globalPresence && typeof state.globalPresence === 'object' && 'globalPresence' in state.globalPresence) {
      // Handle nested structure bug
      console.warn('⚠️ getLocationPresence: Detected nested globalPresence structure, extracting array');
      globalPresence = (state.globalPresence as any).globalPresence || [];
    } else {
      console.warn('⚠️ getLocationPresence: globalPresence is not an array, defaulting to []');
      globalPresence = [];
    }

    // Filter by location (null or '' = London)
    const targetLocationId = locationId || '';

    return globalPresence.filter((p) => p.locationId === targetLocationId);
  },

  reset: () => {
    set(initialState);
  },
}));
