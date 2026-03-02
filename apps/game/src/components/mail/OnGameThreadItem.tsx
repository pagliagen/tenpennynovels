/**
 * OnGame Thread Item Component
 *
 * Single conversation row in the inbox list.
 * Displays partner avatar, name, last message preview, and unread badge.
 *
 * @module components/mail/OnGameThreadItem
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/mail/OnGameMail.module.scss';
import type { OnGameThread } from '@/types/mail';

/**
 * OnGame Thread Item Props
 *
 * @interface OnGameThreadItemProps
 * @since 2.0.0
 */
interface OnGameThreadItemProps {
  /** Thread data */
  thread: OnGameThread;

  /** Click handler */
  onClick: () => void;
}

/**
 * Format timestamp for display
 *
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time ("Ora", "2h fa", "DD/MM")
 */
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const sentDate = new Date(timestamp);
  const diffMs = now.getTime() - sentDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ora';
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays < 30) {
    const day = sentDate.getDate().toString().padStart(2, '0');
    const month = (sentDate.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  const day = sentDate.getDate().toString().padStart(2, '0');
  const month = (sentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = sentDate.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * OnGame Thread Item Component
 *
 * @component
 * @param {OnGameThreadItemProps} props - Component props
 * @returns {JSX.Element} Thread item
 * @since 2.0.0
 */
export function OnGameThreadItem({ thread, onClick }: OnGameThreadItemProps): JSX.Element {
  const isUnread = thread.unreadCount > 0;

  // Avatar: use image if available, otherwise first letter of name
  const avatarContent = thread.partnerAvatar ? (
    <img src={thread.partnerAvatar} alt={thread.partnerName} />
  ) : (
    thread.partnerName.charAt(0).toUpperCase()
  );

  // Preview: icon + "Tu: " if sent by me + truncated content
  const previewPrefix = thread.lastMessage.isSentByMe ? 'Tu: ' : '';
  const previewContent = thread.lastMessage.content.slice(0, 50);
  const previewSuffix = thread.lastMessage.content.length > 50 ? '...' : '';

  return (
    <div
      className={`${styles.threadItem} ${isUnread ? styles.unread : ''}`}
      onClick={onClick}
    >
      <div className={styles.threadAvatar}>{avatarContent}</div>

      <div className={styles.threadContent}>
        <div className={styles.threadHeader}>
          <h3 className={styles.threadTitle}>{thread.partnerName}</h3>
          <span className={styles.threadTime}>
            {formatTimestamp(thread.lastMessage.sentAt)}
          </span>
        </div>

        <p className={styles.threadPreview}>
          <span className={styles.previewIcon}>{thread.lastMessage.icon}</span>
          {thread.lastMessage.isSentByMe && (
            <span className={styles.sentByMe}>{previewPrefix}</span>
          )}
          {previewContent}{previewSuffix}
        </p>
      </div>

      {isUnread && (
        <div className={styles.unreadBadge}>
          {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
        </div>
      )}
    </div>
  );
}
