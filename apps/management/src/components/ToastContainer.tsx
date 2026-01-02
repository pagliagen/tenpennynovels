import React, { useEffect, useState } from 'react';
import { useNotification, Toast } from '../contexts/NotificationContext';
import styles from '../styles/toast.module.scss';

// Toast item component with animations
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  // Handle dismiss with exit animation
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200); // Match animation duration
  };

  // Icon based on type
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '';
    }
  };

  return (
    <div
      className={`${styles.messageToast} ${styles[`message-${toast.type}`]} ${isExiting ? styles.toastExit : styles.toastEnter}`}
      role="alert"
      aria-live="polite"
    >
      <div className={styles.toastContent}>
        <span className={styles.toastIcon}>{getIcon()}</span>
        <span className={styles.toastMessage}>{toast.message}</span>
      </div>
      <button
        className={styles.toastClose}
        onClick={handleDismiss}
        aria-label="Chiudi notifica"
        type="button"
      >
        ✕
      </button>
    </div>
  );
};

// Toast container component
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotification();

  return (
    <div className={styles.toastContainer} aria-label="Notifiche">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
