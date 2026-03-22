/**
 * OffGame Message Item Component
 *
 * Single message bubble in thread view.
 * Shows sender name (groups), content, timestamp, read receipts.
 *
 * @module components/offGameChat/OffGameMessageItem
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';
import type { ChatMessage } from '@/types/offGameChat';

interface OffGameMessageItemProps {
  message: ChatMessage;
  isSentByMe: boolean;
  showSenderName: boolean; // True for group chats
}

export function OffGameMessageItem({
  message,
  isSentByMe,
  showSenderName,
}: OffGameMessageItemProps): JSX.Element {
  // Format timestamp
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`${styles.messageItem} ${
        message.actionType === 'system'
          ? styles.system
          : isSentByMe
          ? styles.own
          : styles.other
      }`}
    >
      {/* Sender name (only for group chats and non-system messages) */}
      {showSenderName && message.actionType !== 'system' && !isSentByMe && (
        <div className={styles.senderName}>{message.senderName || 'Sconosciuto'}</div>
      )}

      {/* Message content */}
      <div className={styles.messageContent}>{message.content}</div>

      {/* Timestamp + read receipts (only for user messages) */}
      {message.actionType !== 'system' && (
        <div className={styles.messageTime}>
          {formatTime(message.timestamp)}
          {isSentByMe && (
            <span style={{ marginLeft: '0.25rem' }}>
              {message.readBy.length === 0
                ? '✓' // Sent
                : message.readBy.length === 1
                ? '✓✓' // Delivered
                : '✓✓'} {/* Read (future: blue checkmarks) */}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
