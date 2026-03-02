/**
 * Data Summary Card Component
 *
 * Displays a section of character data in a card format for review.
 *
 * @module components/character/wizard/shared/DataSummaryCard
 * @since 2.0.0
 */

'use client';

import { ReactNode } from 'react';
import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Props for DataSummaryCard
 */
interface DataSummaryCardProps {
  /** Card title */
  title: string;
  /** Card content (summary rows) */
  children: ReactNode;
  /** Optional icon */
  icon?: string;
}

/**
 * Data Summary Card Component
 *
 * Used in Step 6 Review to display sections of character data.
 *
 * @param {DataSummaryCardProps} props - Component props
 * @returns {JSX.Element} Data summary card
 */
export function DataSummaryCard({ title, children, icon }: DataSummaryCardProps): JSX.Element {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryCardHeader}>
        {icon && <span className={styles.summaryCardIcon}>{icon}</span>}
        <h3 className={styles.summaryCardTitle}>{title}</h3>
      </div>
      <div className={styles.summaryCardContent}>{children}</div>
    </div>
  );
}
