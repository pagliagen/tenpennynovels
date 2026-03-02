/**
 * Moon Phase Component
 *
 * Displays current moon phase icon based on real astronomical data.
 * Fetches data from EnvironmentContext which updates every 5 minutes.
 *
 * @module components/sidebar/MoonPhase
 * @since 2.0.0
 */

'use client';

import { useEnvironment } from '@/contexts/EnvironmentContext';
import styles from '@/styles/components/MoonPhase.module.scss';

/**
 * Moon Phase Component
 *
 * Renders moon phase icon based on real-time lunar cycle.
 * Falls back to 'waning_crescent' if data not available.
 *
 * @component
 * @returns {JSX.Element} Moon phase display
 * @since 2.0.0
 */
export function MoonPhase(): JSX.Element {
  const { environment } = useEnvironment();
  const phase = environment?.moonPhase || 'waning_crescent';

  const moonImageUrl = `/images/sidebar/moon-${phase}.png`;

  return (
    <div className={styles.moonPhase}>
      <img
        src={moonImageUrl}
        alt={`Moon phase: ${phase}`}
        className={styles.moonImage}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/images/sidebar/moon-new.png';
        }}
      />
    </div>
  );
}
