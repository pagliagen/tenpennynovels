/**
 * LoadingSpinner - Simple loading spinner component
 */

import React from 'react';
import styles from '@/styles/components/LoadingSpinner.module.scss';
import classNames from 'classnames';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

export function LoadingSpinner({
  size = 'medium',
  color,
  className
}: LoadingSpinnerProps): React.ReactElement {
  return (
    <div
      className={classNames(styles.spinner, styles[size], className)}
      style={color ? { borderTopColor: color } : undefined}
      role="status"
      aria-label="Caricamento in corso"
    >
      <span className={styles.srOnly}>Caricamento...</span>
    </div>
  );
}
