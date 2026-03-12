import React, { useState, useRef, useEffect } from 'react';
import { useAdminNotificationStore, selectUnreadCount, selectIsShaking } from '@/store/adminNotificationStore';
import { NotificationDropdown } from './NotificationDropdown';
import styles from '@/styles/components/NotificationBell.module.scss';
import classNames from 'classnames';

export function NotificationBell(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useAdminNotificationStore(selectUnreadCount);
  const isShaking = useAdminNotificationStore(selectIsShaking);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.bellContainer} ref={containerRef}>
      <button
        className={classNames(styles.bellButton, { [styles.shaking]: isShaking })}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
      >
        <svg
          className={styles.bellIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
}
