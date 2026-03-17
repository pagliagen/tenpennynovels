/**
 * Location Presence List Component
 *
 * Mini-list showing ONLY characters in the same location as current character.
 * Displays in sidebar below PresenceButton.
 *
 * Features:
 * - Shows ALL characters in location (no limit, scrollable)
 * - Custom Victorian scrollbar
 * - Real-time updates via WebSocket (player_entered/player_left)
 * - Empty state: "Nessun altro presente"
 * - Avatar thumbnails (32px) + truncated names
 * - Accessibility (ARIA labels, keyboard navigation)
 *
 * @module components/sidebar/LocationPresenceList
 * @since 2.0.0
 */

'use client';

import { usePresence } from '@/hooks/usePresence';
import { useGameStateStore } from '@/store/gameStateStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/PresenceSection.module.scss';

/**
 * Location Presence List Component
 *
 * Renders mini-list of characters in same location.
 * Scrollable if > 5 players (user accepted scroll).
 *
 * @component
 * @returns {JSX.Element} Location presence list
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <LocationPresenceList />
 * ```
 */
export function LocationPresenceList(): JSX.Element {
  const { locationPresence, isLoading } = usePresence();
  const { openWindow } = useWindowManagerStore();

  // Get current location ID (SINGLE SOURCE OF TRUTH from GameStateStore)
  const currentLocationId = useGameStateStore((state) => state.currentLocationId);

  // Get current location name
  const locationName = currentLocationId
    ? 'In questa location' // TODO: Get actual location name from API if needed
    : 'A Londra';

  // Defensive: ensure array
  const characters = locationPresence || [];

  if (isLoading) {
    return (
      <div className={styles.locationPresenceList}>
        <div className={styles.listHeader}>{locationName}</div>
        <div className={styles.emptyState}>Caricamento...</div>
      </div>
    );
  }

  return (
    <div className={styles.locationPresenceList} role="region" aria-label="Personaggi presenti in questa location">
      <div className={styles.listHeader}>{locationName}</div>

      {characters.length === 0 ? (
        <div className={styles.emptyState}>Nessuno presente</div>
      ) : (
        <ul className={styles.playerList} role="list">
          {characters.map((presence) => (
            <li key={presence.characterId} className={styles.playerItem} role="listitem">
              <button
                type="button"
                className={styles.playerButton}
                aria-label={`${presence.characterName}. Clicca per vedere profilo`}
                onClick={() => {
                  openWindow('characterSheet', {
                    characterId: presence.characterId,
                    characterName: presence.characterName,
                    avatar: presence.avatar || undefined,
                  });
                }}
              >
                {presence.characterName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
