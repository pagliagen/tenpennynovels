/**
 * Presence Button Component
 *
 * Simple sidebar button that navigates to /presenti-online page.
 *
 * @module components/sidebar/PresenceButton
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';
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
  const router = useRouter();

  const handleClick = () => {
    router.push('/presenti-online');
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
