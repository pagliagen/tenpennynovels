/**
 * ErrorMessage Component
 *
 * Victorian-themed error display with retry functionality.
 *
 * @module components/ui/ErrorMessage
 * @since 1.0.0
 */

'use client';

import styles from '@/styles/components/ui/ErrorMessage.module.scss';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorMessage({
  title = 'Errore',
  message,
  onRetry,
  fullPage = false,
}: ErrorMessageProps): JSX.Element {
  const content = (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <span className={styles.icon}>⚠</span>
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Riprova
        </button>
      )}
    </div>
  );

  if (fullPage) {
    return <div className={styles.fullPageWrapper}>{content}</div>;
  }

  return content;
}
