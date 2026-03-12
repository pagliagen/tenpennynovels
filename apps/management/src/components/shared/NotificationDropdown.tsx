import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAdminNotificationStore } from '@/store/adminNotificationStore';
import styles from '@/styles/components/NotificationBell.module.scss';
import classNames from 'classnames';

type TabFilter = 'unread' | 'read';

interface NotificationDropdownProps {
  onClose: () => void;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'Adesso';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g fa`;
  return new Date(timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>('unread');
  const notifications = useAdminNotificationStore((s) => s.notifications);
  const markAsRead = useAdminNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useAdminNotificationStore((s) => s.markAllAsRead);
  const removeNotification = useAdminNotificationStore((s) => s.removeNotification);
  const clearAll = useAdminNotificationStore((s) => s.clearAll);

  const filtered = useMemo(
    () => notifications.filter((n) => (activeTab === 'unread' ? !n.read : n.read)),
    [notifications, activeTab]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleNotificationClick = (id: string, link: string) => {
    markAsRead(id);
    onClose();
    router.push(link);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
  };

  return (
    <div className={styles.dropdown}>
      <div className={styles.dropdownHeader}>
        <h3 className={styles.dropdownTitle}>Notifiche</h3>
        <div className={styles.dropdownActions}>
          {unreadCount > 0 && (
            <button
              className={styles.markAllRead}
              onClick={markAllAsRead}
            >
              Segna tutte come lette
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className={styles.clearAllBtn}
              onClick={clearAll}
            >
              Svuota
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === 'unread' })}
          onClick={() => setActiveTab('unread')}
        >
          Da leggere {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === 'read' })}
          onClick={() => setActiveTab('read')}
        >
          Lette
        </button>
      </div>

      <div className={styles.notificationList}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {activeTab === 'unread' ? 'Nessuna notifica da leggere' : 'Nessuna notifica letta'}
          </div>
        ) : (
          filtered.map((notification) => (
            <div
              key={notification.id}
              className={classNames(styles.notificationItem, {
                [styles.unread]: !notification.read
              })}
              onClick={() => handleNotificationClick(notification.id, notification.link)}
            >
              <div className={styles.notificationContent}>
                <span className={styles.notificationTitle}>{notification.title}</span>
                <span className={styles.notificationMessage}>{notification.message}</span>
                <span className={styles.notificationTime}>
                  {formatRelativeTime(notification.timestamp)}
                </span>
              </div>
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemove(e, notification.id)}
                aria-label="Rimuovi notifica"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
