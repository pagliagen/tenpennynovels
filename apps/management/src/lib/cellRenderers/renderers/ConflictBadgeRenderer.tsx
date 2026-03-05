/**
 * ConflictBadgeRenderer
 *
 * Renders a badge indicating if originalKeys have conflicts (already taken by another record)
 */

import React from 'react';
import type { CellRendererProps } from '../registry';
import styles from './ConflictBadgeRenderer.module.scss';

export function ConflictBadgeRenderer({ value, item }: CellRendererProps) {
  // value is keyConflicts object: { username: true, email: false }
  const conflicts = value as Record<string, boolean> | undefined;

  if (!conflicts || Object.keys(conflicts).length === 0) {
    // No conflicts - keys are available
    return (
      <span className={styles.okBadge} title="All original keys are available">
        ✓ Disponibili
      </span>
    );
  }

  // Check if any key has conflict
  const conflictKeys = Object.keys(conflicts).filter(key => conflicts[key]);

  if (conflictKeys.length === 0) {
    // All keys available
    return (
      <span className={styles.okBadge} title="All original keys are available">
        ✓ Disponibili
      </span>
    );
  }

  // Some keys have conflicts
  const conflictCount = conflictKeys.length;
  const conflictList = conflictKeys.join(', ');

  return (
    <span
      className={styles.warningBadge}
      title={`Chiavi in uso: ${conflictList}`}
    >
      ⚠️ {conflictCount} {conflictCount === 1 ? 'Conflitto' : 'Conflitti'}
    </span>
  );
}
