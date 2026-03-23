/**
 * Date Display Component
 *
 * Shows in-game date on a curved path. Updates automatically at midnight.
 *
 * @module components/sidebar/DateDisplay
 * @since 2.0.0
 */

'use client';

import { useEffect, useState } from 'react';

import styles from '@/styles/components/DateDisplay.module.scss';

const GAME_YEAR = 1839;

function formatDisplayDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  return `${day}/${month}/${GAME_YEAR}`;
}

function getNextMidnight(): number {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

/**
 * Date Display Component
 *
 * Renders in-game date on a curved path. Re-renders when the date changes (e.g. after midnight).
 *
 * @component
 * @returns {JSX.Element} Date display
 * @since 2.0.0
 */
export function DateDisplay(): JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
    }, getNextMidnight() - Date.now());

    return () => window.clearTimeout(timeoutId);
  }, [now]);

  const formattedDate = formatDisplayDate(now);

  const arcRadius = 80;
  const arcDate = `M 0 25 A ${arcRadius} ${arcRadius} 0 0 1 135 25`;

  return (
    <div className={styles.dateDisplay}>
      <svg
        className={styles.curveSvg}
        viewBox="0 0 135 10"
        width={135}
        height={10}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <path id="curve_date" d={arcDate} fill="none" />
        <text fill="currentColor" fontSize="inherit" fontFamily="inherit" fontWeight="inherit">
          <textPath href="#curve_date" startOffset="50%" textAnchor="middle">
            {formattedDate}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
