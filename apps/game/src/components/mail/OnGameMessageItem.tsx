/**
 * OnGame Message Item Component
 *
 * Single message bubble in conversation view.
 * Displays message type icon, subject, content, time, and postage cost.
 * Shows "in transit" badge for undelivered messages.
 *
 * @module components/mail/OnGameMessageItem
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/mail/OnGameMail.module.scss';
import type { OnGameThreadMessage } from '@/types/mail';

/**
 * OnGame Message Item Props
 *
 * @interface OnGameMessageItemProps
 * @since 2.0.0
 */
interface OnGameMessageItemProps {
  /** Message data */
  message: OnGameThreadMessage;

  /** Whether message was sent by current character */
  isSentByMe: boolean;
}

/**
 * Format timestamp for display
 *
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time ("HH:MM", "DD/MM HH:MM")
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (isToday) {
    return `${hours}:${minutes}`;
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * OnGame Message Item Component
 *
 * @component
 * @param {OnGameMessageItemProps} props - Component props
 * @returns {JSX.Element} Message bubble
 * @since 2.0.0
 */
export function OnGameMessageItem({ message, isSentByMe }: OnGameMessageItemProps): JSX.Element {
  // Check if message is in transit (not yet delivered and scheduled for future)
  const isInTransit =
    !message.deliveredAt &&
    message.scheduledDelivery &&
    new Date(message.scheduledDelivery) > new Date();

  return (
    <div
      className={`${styles.messageItem} ${isSentByMe ? styles.sent : styles.received} ${
        isInTransit ? styles.inTransit : ''
      }`}
    >
      {/* Message header: icon, time, postage */}
      <div className={styles.messageHeader}>
        <span className={styles.messageIcon}>{message.icon}</span>
        <span className={styles.messageTime}>{formatTimestamp(message.sentAt)}</span>
        {message.postageCharged > 0 && (
          <span className={styles.messagePostage}>({message.postageCharged}p)</span>
        )}
      </div>

      {/* Subject */}
      {message.subject && (
        <div className={styles.messageSubject}>{message.subject}</div>
      )}

      {/* Content */}
      <div className={styles.messageContent}>{message.content}</div>

      {/* In transit badge */}
      {isInTransit && message.scheduledDelivery && (
        <div className={styles.inTransitBadge}>
          🕐 In transito · Arrivo previsto: {formatTimestamp(message.scheduledDelivery)}
        </div>
      )}
    </div>
  );
}
