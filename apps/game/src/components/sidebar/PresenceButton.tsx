/**
 * Presence Button Component
 *
 * Simple sidebar button that opens presence modal.
 *
 * @module components/sidebar/PresenceButton
 * @since 2.0.0
 */

'use client';

import { usePresenceStore } from '@/store/presenceStore';
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
  const openModal = usePresenceStore((s) => s.openModal);

  const handleClick = () => {
    openModal();
  };

  return (
    <button
      type="button"
      className={styles.presenceButton}
      onClick={handleClick}
      aria-label="Vedi lista presenti online"
    >
      Presenze
    </button>
  );
}
