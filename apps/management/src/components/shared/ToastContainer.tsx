/**
 * ToastContainer - Display toast notifications
 *
 * Integrates with notificationStore
 */

import React from 'react';
import classNames from 'classnames';
import { useNotificationStore, Notification } from '@/store/notificationStore';
import styles from '@/styles/components/ToastContainer.module.scss';

function Toast({ notification }: { notification: Notification }): React.ReactElement {
  const removeNotification = useNotificationStore(state => state.removeNotification);

  return (
    <div className={classNames(styles.toast, styles[notification.type])}>
      <div className={styles.toastContent}>
        {notification.title && (
          <div className={styles.toastTitle}>{notification.title}</div>
        )}
        <div className={styles.toastMessage}>{notification.message}</div>
      </div>

      <div className={styles.toastActions}>
        {notification.action && (
          <button
            onClick={() => {
              notification.action?.handler();
              removeNotification(notification.id);
            }}
            className={styles.actionButton}
          >
            {notification.action.label}
          </button>
        )}
        <button
          onClick={() => removeNotification(notification.id)}
          className={styles.closeButton}
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastContainer(): React.ReactElement {
  const notifications = useNotificationStore(state => state.notifications);

  return (
    <div className={styles.toastContainer}>
      {notifications.map(notification => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
