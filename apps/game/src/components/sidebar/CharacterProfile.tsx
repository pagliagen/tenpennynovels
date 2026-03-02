/**
 * Character Profile Component
 *
 * Displays character avatar and name in the sidebar.
 * Reads data from auth session (useAuthStore).
 *
 * **Clickable**: Opens wizard (DRAFT) or character sheet modal (other statuses).
 *
 * @module components/sidebar/CharacterProfile
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/sidebar/CharacterProfile.module.scss';

/**
 * Character Profile Component
 *
 * Shows character avatar with frame and character name.
 * Avatar falls back to default image on error.
 *
 * **Click Behavior**:
 * - If status === 'DRAFT' → Navigate to `/character/wizard`
 * - Else → Open CharacterSheetModal (Phase 4, not implemented yet)
 *
 * @component
 * @returns {JSX.Element | null} Character profile display or null if no character
 * @since 2.0.0
 */
export function CharacterProfile(): JSX.Element | null {
  const router = useRouter();
  const { selectedCharacter } = useAuthStore();
  const { openWindow } = useWindowManagerStore();

  if (!selectedCharacter) {
    return null;
  }

  const characterName = selectedCharacter.name || 'Unknown Character';

  /**
   * Handle Avatar Click
   *
   * Opens wizard (DRAFT) or character sheet window (other statuses).
   */
  const handleClick = () => {
    if (selectedCharacter.status === 'DRAFT') {
      // DRAFT → Navigate to wizard page (character not completed)
      router.push('/character/wizard');
    } else {
      // PENDING_APPROVAL, APPROVED, DELETED → Open character sheet window
      openWindow('characterSheet', {
        characterId: selectedCharacter._id,
        characterName: selectedCharacter.name,
        avatar: selectedCharacter.avatar,
      });
    }
  };

  return (
    <>
      <div className={styles.characterProfile} onClick={handleClick} role="button" tabIndex={0} aria-label={`View ${characterName} character sheet`}>
        <div className={styles.avatarContainer}>
          <img
            src="/images/sidebar/miniavatar_cornice.png"
            alt="Avatar frame"
            className={styles.avatarFrame}
          />
          <img
            src={selectedCharacter.avatar || '/images/sidebar/miniavatar_default.png'}
            alt={characterName}
            className={styles.avatarImage}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/sidebar/miniavatar_default.png';
            }}
          />
        </div>
        <div className={styles.characterName}>
          {characterName}
        </div> 
      </div>
    </>
  );
}
