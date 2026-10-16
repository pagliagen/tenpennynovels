/**
 * Presence Button Component
 *
 * Simple sidebar button that opens the presence window.
 *
 * @module components/sidebar/PresenceButton
 * @since 2.0.0
 */

'use client';

import { usePresenceWindow } from '@/hooks/usePresenceWindow';
import styles from '@/styles/components/PresenceSection.module.scss';

/**
 * Presence Button Component
 *
 * Renders simple clickable "Presenti Online" button.
 *
 * @component
 * @returns {JSX.Element} Presence button
 */
export function PresenceButton(): JSX.Element {
  const { open } = usePresenceWindow();

  return (
    <button
      type="button"
      className={styles.presenceButton}
      onClick={open}
      aria-label="Vedi lista presenti online"
    >
      Presenze
    </button>
  );
}
