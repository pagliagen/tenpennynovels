/**
 * Date Display Component
 *
 * Shows in-game date and time.
 *
 * Features (TODO):
 * - Victorian-era date formatting
 * - Real-time updates
 * - Timezone handling
 *
 * @module components/sidebar/DateDisplay
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/DateDisplay.module.scss';

/**
 * Date Display Component
 *
 * Renders placeholder date.
 * Real date will come from TanStack Query in next steps.
 *
 * @component
 * @returns {JSX.Element} Date display
 * @since 2.0.0
 */
export function DateDisplay(): JSX.Element {
  return (
    <div className={styles.dateDisplay}>
      <div className={styles.date}>15th November 1889</div>
      <div className={styles.time}>23:45</div>
    </div>
  );
}
