/**
 * Badge Cell Renderer - Display value as a colored badge
 */

import React from 'react';
import classNames from 'classnames';
import { CellRendererProps } from '../registry';

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
    return <span style={{ color: '#999' }}>-</span>;
  }

  const stringValue = String(value).toLowerCase();
  const label = String(value);

  // Get color from column config or default
  const options = column.render?.options || [];
  const option = options.find(opt => String(opt.value).toLowerCase() === stringValue);
  const color = option?.color || DEFAULT_COLORS[stringValue] || '#666';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.85em',
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}`
      }}
    >
      {label}
    </span>
  );
}
