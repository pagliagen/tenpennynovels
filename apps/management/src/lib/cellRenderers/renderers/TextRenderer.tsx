/**
 * Text Cell Renderer - Simple text display
 */

import React from 'react';
import { CellRendererProps } from '../registry';

export function TextRenderer({ value }: CellRendererProps): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#999' }}>-</span>;
  }

  // Handle arrays: show length (count)
  if (Array.isArray(value)) {
    return <span>{value.length}</span>;
  }

  // Handle objects: show [Object] warning
  if (typeof value === 'object') {
    return <span style={{ color: '#999' }}>[Object]</span>;
  }

  return <span>{String(value)}</span>;
}
