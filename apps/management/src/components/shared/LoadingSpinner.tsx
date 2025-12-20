import React from 'react';
import styles from '@/styles/components/shared/LoadingSpinner.module.scss';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  className
}) => {
  return (
    <div className={`${styles.spinnerContainer} ${styles[size]} ${className || ''}`}>
      <div className={styles.spinner}>
        <div className={styles.doubleBounce1}></div>
        <div className={styles.doubleBounce2}></div>
      </div>
    </div>
  );
};
