/**
 * DerivedStatCard - Compact card for displaying a derived stat
 *
 * @module components/character/wizard/shared/DerivedStatCard
 */

import styles from '@/styles/components/character/wizard/DerivedStatCard.module.scss';

export interface DerivedStatCardProps {
  label: string;
  value: number | string;
  formula?: string;
  description?: string;
}

export function DerivedStatCard({
  label,
  value,
  formula,
  description,
}: DerivedStatCardProps) {
  return (
    <div className={styles.root}>
      <div className={styles.valueWrapper}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      {formula && <span className={styles.formula}>{formula}</span>}
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
