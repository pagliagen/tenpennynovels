/**
 * Badge Cell Renderer - Display value as a colored badge
 */

import type { CSSProperties } from 'react';
import React from 'react';
import { CellRendererProps } from '../registry';

import styles from './CellRenderers.module.scss';

/**
 * Default badge colors
 */
const DEFAULT_COLORS: Record<string, string> = {
  active: '#4caf50',
  inactive: '#999',
  banned: '#f44336',
  pending: '#ff9800',
  approved: '#4caf50',
  rejected: '#f44336',
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3'
};

export function BadgeRenderer({ value, column }: CellRendererProps): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className={styles.empty}>-</span>;
  }

  const stringValue = String(value).toLowerCase();
  const label = String(value);

  // Get color from column config or default
  const options = column.render?.options || [];
  const option = options.find(opt => String(opt.value).toLowerCase() === stringValue);
  const color = option?.color || DEFAULT_COLORS[stringValue] || '#666';

  return (
    <span
      className={styles.badge}
      style={{ '--badge-color': color } as CSSProperties}
    >
      {label}
    </span>
  );
}
