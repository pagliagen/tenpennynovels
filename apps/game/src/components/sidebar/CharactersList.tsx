/**
 * Characters List Component (Presenze Online)
 *
 * Container for presence system in sidebar.
 * Combines PresenceButton + LocationPresenceList.
 *
 * Features:
 * - Button with total/location online count
 * - Mini-list of characters in same location (scrollable)
 * - Real-time updates via WebSocket
 * - Navigation to full presence page
 *
 * @module components/sidebar/CharactersList
 * @since 2.0.0
 */

'use client';

import { PresenceButton } from './PresenceButton';
import { LocationPresenceList } from './LocationPresenceList';
import styles from '@/styles/components/PresenceSection.module.scss';

/**
 * Characters List Component
 *
 * Renders presence section in sidebar (button + mini-list).
 *
 * @component
 * @returns {JSX.Element} Presence section
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <CharactersList />
 * ```
 */
export function CharactersList(): JSX.Element {
  return (
    <div className={styles.presenceSection}>
      <PresenceButton />
      <LocationPresenceList />
    </div>
  );
}
