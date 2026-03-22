/**
 * usePresence Hook
 *
 * Manages global presence state with real-time WebSocket updates.
 * This hook bridges WebSocketContext and presenceStore.
 *
 * Features:
 * - Fetches initial presence data from API on mount
 * - Subscribes to WebSocket events (player_entered, player_left, global_presence_update)
 * - Provides location-filtered presence (characters in same location)
 * - Automatic cleanup on unmount
 *
 * CRITICAL: This hook follows MEMORY.md WebSocket pattern.
 * - Subscriptions via onLocationEvent / onGlobalEvent callbacks
 * - NO direct socket.on() calls (violates pattern)
 * - Automatic unsubscribe on unmount
 *
 * @module hooks/usePresence
 * @since 2.0.0
 */

import { useEffect } from 'react';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/store/authStore';
import { useGameStateStore } from '@/store/gameStateStore';
import { usePresenceStore, GlobalPresence } from '@/store/presenceStore';

/**
 * usePresence Hook Return Type
 *
 * @interface UsePresenceReturn
 * @since 2.0.0
 *
 * @property {GlobalPresence[]} globalPresence - All online characters
 * @property {GlobalPresence[]} locationPresence - Characters in same location as current character
 * @property {boolean} isLoading - Whether initial API fetch is in progress
 * @property {string | null} error - Error message if API fetch failed
 * @property {() => Promise<void>} refetch - Manually refetch presence data from API
 */
interface UsePresenceReturn {
  globalPresence: GlobalPresence[];
  locationPresence: GlobalPresence[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * usePresence Hook
 *
 * Manages global presence state with real-time WebSocket updates.
 *
 * @returns {UsePresenceReturn} Presence data and actions
 *
 * @example
 * ```typescript
 * function PresenceList() {
 *   const { globalPresence, locationPresence, isLoading } = usePresence();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>In This Location ({locationPresence.length})</h2>
 *       {locationPresence.map(p => <PlayerCard key={p.characterId} presence={p} />)}
 *
 *       <h2>All Online ({globalPresence.length})</h2>
 *       {globalPresence.map(p => <PlayerCard key={p.characterId} presence={p} />)}
 *     </div>
 *   );
 * }
 * ```
 *
 * @since 2.0.0
 */
export function usePresence(): UsePresenceReturn {
  const {
    globalPresence,
    isLoading,
    error,
    initialize,
    handlePlayerEntered,
    handlePlayerLeft,
    handleGlobalPresenceUpdate,
    handleCharacterActive,
    handleCharacterInactive,
    getLocationPresence,
  } = usePresenceStore();

  const { selectedCharacter } = useAuthStore();
  const { onLocationEvent, onGlobalEvent, socket } = useWebSocket();

  // Initialize presence store on mount (fetch from API)
  useEffect(() => {
    if (selectedCharacter) {
      console.log('🔄 usePresence: Initializing presence store for character:', selectedCharacter._id);
      initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id, initialize]);

  // Subscribe to location events (MEMORY.md pattern)
  useEffect(() => {
    const unsubscribe = onLocationEvent((event) => {
      console.log('📥 usePresence: Received location event:', event.type, event.data);

      switch (event.type) {
        case 'player_entered':
          // Character entered current location (room-scoped)
          handlePlayerEntered(event.data);
          break;

        case 'player_left':
          // Character left current location (room-scoped)
          handlePlayerLeft(event.data);
          break;

        case 'location_joined':
          // Current character joined new location (confirmation)
          // Refetch presence to sync with server truth
          if (selectedCharacter) {
            console.log('🔄 usePresence: location_joined event - refetching presence');
            initialize(selectedCharacter._id);
          }
          break;

        default:
          // Other location events (typing, messages) - ignore for presence
          break;
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [onLocationEvent, handlePlayerEntered, handlePlayerLeft, initialize, selectedCharacter]);

  // Subscribe to global events (MEMORY.md pattern)
  useEffect(() => {
    const unsubscribe = onGlobalEvent((event) => {
      console.log('📥 usePresence: Received global event:', event.type, event.data);

      switch (event.type) {
        case 'global_presence_update':
          // Character moved between locations (broadcast to ALL clients)
          handleGlobalPresenceUpdate(event.data);
          break;

        case 'character_active':
          // Character became active (user selected character)
          console.log('📥 usePresence: character_active event:', event.data);
          handleCharacterActive(event.data);
          break;

        case 'character_inactive':
          // Character went inactive (user logged out)
          console.log('📥 usePresence: character_inactive event:', event.data);
          handleCharacterInactive(event.data);
          break;

        case 'user_status_change':
          // DEPRECATED for presence - kept for other systems
          console.log('📥 usePresence: user_status_change event (ignored for presence)');
          break;

        default:
          // Other global events - ignore for presence
          break;
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [onGlobalEvent, handleGlobalPresenceUpdate]);

  // Refetch presence after WebSocket reconnect (catch up on missed events)
  useEffect(() => {
    if (!socket || !selectedCharacter) return;

    const handleReconnect = () => {
      console.log('🔄 usePresence: WebSocket reconnected - refetching presence');
      initialize(selectedCharacter._id);
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, selectedCharacter, initialize]);

  // Compute location-filtered presence (characters in same location as current character)
  // SINGLE SOURCE OF TRUTH: currentLocationId from GameStateStore
  const currentLocationId = useGameStateStore((state) => state.currentLocationId);
  const locationPresence = getLocationPresence(currentLocationId);

  return {
    globalPresence,
    locationPresence,
    isLoading,
    error,
    refetch: () => {
      if (selectedCharacter) {
        return initialize(selectedCharacter._id);
      }
      return Promise.resolve();
    },
  };
}
