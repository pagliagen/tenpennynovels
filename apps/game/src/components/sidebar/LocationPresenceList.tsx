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

import { useRouter } from 'next/router';

import { usePresence } from '@/hooks/usePresence';
import { useAuthStore } from '@/store/authStore';
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
  const router = useRouter();
  const { locationPresence, isLoading } = usePresence();
  const { openWindow } = useWindowManagerStore();
  const { selectedCharacter, hasGamePermission } = useAuthStore();

  // Get current location from GameStateStore (SINGLE SOURCE OF TRUTH)
  const currentLocationName = useGameStateStore((state) => state.currentLocationName);

  // Display location name (fallback to "A Londra" if not in location)
  const locationName = currentLocationName || 'A Londra';

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
          {characters.map((presence) => {
            return (
              <li key={presence.characterId} className={styles.playerItem} role="listitem">
                <button
                  type="button"
                  className={styles.playerButton}
                  aria-label={`${presence.characterName}. Clicca per vedere profilo`}
                  onClick={() => {
                    const isOwnDraftCharacter =
                      presence.characterId === selectedCharacter?._id &&
                      selectedCharacter?.playerStatus === 'draft' &&
                      hasGamePermission('game:character:wizard');

                    if (isOwnDraftCharacter) {
                      router.push('/character/wizard');
                      return;
                    }

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
            );
          })}
        </ul>
      )}
    </div>
  );
}
