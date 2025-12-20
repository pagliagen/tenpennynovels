import React, { useEffect, useState } from 'react';
import { useNotification, Toast } from '../contexts/NotificationContext';
import '../styles/toast.scss';

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
      className={`message message-toast message-${toast.type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-content">
        <span className="toast-icon">{getIcon()}</span>
        <span className="toast-message">{toast.message}</span>
      </div>
      <button
        className="toast-close"
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
    <div className="toast-container" aria-label="Notifiche">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
