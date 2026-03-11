import React from 'react';
import { CellRendererProps } from '../registry';

export function ImageRenderer({ value, column }: CellRendererProps): React.ReactNode {
  const fallback = (column.render as any)?.fallback || '📷';

  if (!value || typeof value !== 'string') {
    return <span style={{ fontSize: '1.5rem', display: 'inline-block', width: 40, textAlign: 'center' }}>{fallback}</span>;
  }

  return (
    <img
      src={value as string}
      alt=""
      style={{
        width: 40,
        height: 40,
        objectFit: 'cover',
        borderRadius: 4,
        display: 'block'
      }}
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = 'none';
        const span = document.createElement('span');
        span.textContent = fallback;
        span.style.fontSize = '1.5rem';
        span.style.display = 'inline-block';
        span.style.width = '40px';
        span.style.textAlign = 'center';
        target.parentElement?.appendChild(span);
      }}
    />
  );
}
