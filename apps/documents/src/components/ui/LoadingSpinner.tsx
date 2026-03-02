/**
 * LoadingSpinner Component
 *
 * Victorian-themed loading spinner with ornate styling.
 *
 * @module components/ui/LoadingSpinner
 * @since 1.0.0
 */

'use client';

import styles from '@/styles/components/ui/LoadingSpinner.module.scss';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullPage?: boolean;
}

export function LoadingSpinner({
  size = 'medium',
  message,
  fullPage = false,
}: LoadingSpinnerProps): JSX.Element {
  const spinnerClass = `${styles.spinner} ${styles[size]}`;

  const content = (
    <div className={styles.container}>
      <div className={spinnerClass}>
        <div className={styles.spinnerInner} />
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );

  if (fullPage) {
    return <div className={styles.fullPageWrapper}>{content}</div>;
  }

  return content;
}
