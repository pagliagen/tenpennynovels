/**
 * Badge List Cell Renderer - Display array as multiple colored badges
 *
 * Perfect for rendering arrays like characterRoles, tags, categories, etc.
 */

import React from 'react';
import { CellRendererProps } from '../registry';

/**
 * Default badge colors for roles
 */
const ROLE_COLORS: Record<string, string> = {
  personaggio: '#2196f3', // Blue
  master: '#9c27b0',      // Purple
  moderatore: '#ff9800',  // Orange
  gestore: '#f44336'      // Red
};

export function BadgeListRenderer({ value, column }: CellRendererProps): React.ReactNode {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span style={{ color: '#999' }}>-</span>;
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
    return <span style={{ color: '#999' }}>Nessuno</span>;
  }

  // Render badges
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {items.map((item, index) => {
        const itemLower = String(item).toLowerCase();
        const color = ROLE_COLORS[itemLower] || '#666';

        return (
          <span
            key={index}
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.85em',
              fontWeight: 600,
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}`,
              whiteSpace: 'nowrap'
            }}
          >
            {String(item)}
          </span>
        );
      })}
    </div>
  );
}
