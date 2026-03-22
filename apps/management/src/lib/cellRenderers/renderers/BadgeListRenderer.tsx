/**
 * Badge List Cell Renderer - Display array as multiple colored badges
 *
 * Perfect for rendering arrays like characterRoles, tags, categories, etc.
 */

import React, { type CSSProperties } from 'react';
import { CellRendererProps } from '../registry';

import styles from './CellRenderers.module.scss';

/**
 * Default badge colors for roles
 */
const ROLE_COLORS: Record<string, string> = {
  personaggio: '#2196f3', // Blue
  master: '#9c27b0',      // Purple
  moderatore: '#ff9800',  // Orange
  gestore: '#f44336'      // Red
};

export function BadgeListRenderer({ value }: CellRendererProps): React.ReactNode {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className={styles.empty}>-</span>;
  }

  // Convert to array if needed
  let items: string[] = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === 'string') {
    // Handle comma-separated string
    items = value.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Empty array
  if (items.length === 0) {
    return <span className={styles.empty}>Nessuno</span>;
  }

  // Render badges
  return (
    <div className={styles.badgeList}>
      {items.map((item, index) => {
        const itemLower = String(item).toLowerCase();
        const color = ROLE_COLORS[itemLower] || '#666';

        return (
          <span
            key={index}
            className={styles.badgeListItem}
            style={{ '--badge-color': color } as CSSProperties}
          >
            {String(item)}
          </span>
        );
      })}
    </div>
  );
}
