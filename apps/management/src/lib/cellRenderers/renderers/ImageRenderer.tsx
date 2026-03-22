import React, { useState } from 'react';
import { CellRendererProps } from '../registry';

import styles from './CellRenderers.module.scss';

export function ImageRenderer({ value, column }: CellRendererProps): React.ReactNode {
  const fallback = (column.render as any)?.fallback || '📷';
  const [failed, setFailed] = useState(false);

  if (!value || typeof value !== 'string' || failed) {
    return <span className={styles.imageFallback}>{fallback}</span>;
  }

  return (
    <img
      src={value as string}
      alt=""
      className={styles.imageThumb}
      onError={() => setFailed(true)}
    />
  );
}
