/**
 * Budget Indicator Component
 *
 * Displays remaining points for stats or skills allocation.
 * Shows progress bar and visual feedback (green/yellow/red).
 *
 * @module components/character/wizard/shared/BudgetIndicator
 * @since 2.0.0
 */

'use client';

import type { CSSProperties } from 'react';

import styles from '@/styles/components/character/wizard/BudgetIndicator.module.scss';

/**
 * Budget Indicator Props
 */
interface BudgetIndicatorProps {
  /** Current points spent */
  spent: number;

  /** Total budget available */
  total: number;

  /** Label (e.g., "Punti Statistiche", "Punti Abilità") */
  label: string;
}

/**
 * Budget Indicator Component
 *
 * Shows budget usage with color-coded feedback:
 * - Green: Under budget (< 80%)
 * - Yellow: Near budget (80-100%)
 * - Red: Over budget (> 100%)
 *
 * @param {BudgetIndicatorProps} props - Component props
 * @returns {JSX.Element} Budget indicator
 */
export function BudgetIndicator({ spent, total, label }: BudgetIndicatorProps): JSX.Element {
  const remaining = total - spent;
  const percentage = (spent / total) * 100;

  // Determine status color
  let statusClass = styles.budgetOk;
  if (percentage >= 100) {
    statusClass = styles.budgetOver;
  } else if (percentage >= 80) {
    statusClass = styles.budgetWarning;
  }

  return (
    <div className={`${styles.budgetIndicator} ${statusClass}`}>
      <div className={styles.budgetHeader}>
        <span className={styles.budgetLabel}>{label}</span>
        <span className={styles.budgetValues}>
          {spent} / {total} <span className={styles.budgetRemaining}>({remaining >= 0 ? remaining : 0} rimanenti)</span>
        </span>
      </div>
      <div className={styles.budgetBar}>
        <div
          className={styles.budgetFill}
          style={
            { '--progress-pct': `${Math.min(percentage, 100)}%` } as CSSProperties
          }
        />
      </div>
      {percentage > 100 && (
        <div className={styles.budgetError}>
          ⚠️ Budget superato di {spent - total} punti!
        </div>
      )}
    </div>
  );
}
