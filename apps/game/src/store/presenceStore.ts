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
import { logger } from '@/lib/logger';

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
 * @property {string} locationSlug - Location slug for navigation (empty string = London)
 * @property {boolean} isCurrentCharacter - Whether this is the requesting character
 * @property {string | null} avatar - Avatar URL (optional)
 */
export interface GlobalPresence {
  characterId: string;
  characterName: string;
  characterSurname: string | null;
  locationId: string;
  locationName: string;
  locationSlug: string;
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
 * @property {boolean} isModalOpen - Whether presence modal is open
 */
interface PresenceState {
  globalPresence: GlobalPresence[];
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
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
   * Handle character_active event
   *
   * Adds character to global presence when they become active.
   *
   * @param {object} event - character_active event data
   * @returns {void}
   */
  handleCharacterActive: (event: {
    characterId: string;
    characterName: string;
    userId: string;
    timestamp: string;
  }) => void;

  /**
   * Handle character_inactive event
   *
   * Removes character from global presence when they go inactive.
   *
   * @param {object} event - character_inactive event data
   * @returns {void}
   */
  handleCharacterInactive: (event: {
    characterId: string;
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
   * Open presence modal
   *
   * @returns {void}
   */
  openModal: () => void;

  /**
   * Close presence modal
   *
   * @returns {void}
   */
  closeModal: () => void;

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
  isModalOpen: false,
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
      // Backend returns: { success: boolean, data: { globalPresence: GlobalPresence[] } }
      const response = await api.get<{ success: boolean; data: { globalPresence: GlobalPresence[] } }>('/game/presence');

      if (response.success && response.data) {
        const presenceArray = response.data.globalPresence ?? [];

        if (!Array.isArray(presenceArray)) {
          logger.error('❌ initialize: presenceArray is not an array!', { presenceArray });
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
      logger.error('Failed to fetch global presence:', { error });
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
          locationSlug: '', // WebSocket events don't have slug - will be updated by API refetch
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
            locationSlug: '', // WebSocket events don't have slug
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
        ? { ...p, locationId: '', locationName: 'London', locationSlug: '' }
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
              locationSlug: '', // WebSocket events don't have slug
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
              locationSlug: '', // WebSocket events don't have slug
            }
          : p
      );
      set({ globalPresence: updated });
    } else if (event.type === 'character_left_location') {
      // Character left location (returned to London)
      const updated = globalPresence.map((p) =>
        p.characterId === event.characterId
          ? { ...p, locationId: '', locationName: 'London', locationSlug: '' }
          : p
      );
      set({ globalPresence: updated });
    }
  },

  handleCharacterActive: (event) => {
    const { globalPresence } = get();
    const existingIndex = globalPresence.findIndex(p => p.characterId === event.characterId);

    if (existingIndex !== -1) {
      // Character already in list (reconnect or duplicate event)
      logger.info('📥 Character already in presence, skipping:', { characterId: event.characterId });
      return;
    }

    // Add new character with minimal data from the WS event. There's no
    // periodic refetch to enrich it later — the next full refresh comes from
    // initialize() on WS connect/reconnect or on entering a location
    // (see usePresence.ts), not from a timer.
    logger.info('📥 Adding character to presence:', { characterId: event.characterId });
    set({
      globalPresence: [
        ...globalPresence,
        {
          characterId: event.characterId,
          characterName: event.characterName,
          characterSurname: null, // Will be filled by API refetch
          locationId: '', // London by default
          locationName: 'London',
          locationSlug: '',
          isCurrentCharacter: false,
          avatar: null // Will be filled by API refetch
        }
      ]
    });
  },

  handleCharacterInactive: (event) => {
    logger.info('📥 Removing character from presence:', { characterId: event.characterId });
    const { globalPresence } = get();

    // Remove character from presence list
    set({
      globalPresence: globalPresence.filter(p => p.characterId !== event.characterId)
    });
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
      logger.warn('⚠️ getLocationPresence: Detected nested globalPresence structure, extracting array');
      const nested = state.globalPresence as { globalPresence?: GlobalPresence[] };
      globalPresence = nested.globalPresence ?? [];
    } else {
      logger.warn('⚠️ getLocationPresence: globalPresence is not an array, defaulting to []');
      globalPresence = [];
    }

    // Filter by location (null or '' = London)
    const targetLocationId = locationId || '';

    return globalPresence.filter((p) => p.locationId === targetLocationId);
  },

  openModal: () => {
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({ isModalOpen: false });
  },

  reset: () => {
    set(initialState);
  },
}));
