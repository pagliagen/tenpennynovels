/**
 * Boolean Cell Renderer - Display boolean as icon/text
 */

import React from 'react';
import { CellRendererProps } from '../registry';

export function BooleanRenderer({ value }: CellRendererProps): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ color: '#999' }}>-</span>;
  }

  const boolValue = Boolean(value);

  return (
    <span
      style={{
        color: boolValue ? '#4caf50' : '#999',
        fontWeight: 600
      }}
    >
      {boolValue ? '✓ Sì' : '✗ No'}
    </span>
  );
}
