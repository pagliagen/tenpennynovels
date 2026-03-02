/**
 * OffGame Chat Item Component
 *
 * Single chat row in the chat list.
 * Shows avatar, chat name, last message preview, timestamp, unread badge.
 *
 * @module components/offGameChat/OffGameChatItem
 * @since 2.0.0
 */

'use client';

import type { ChatPreview } from '@/types/offGameChat';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface OffGameChatItemProps {
  chat: ChatPreview;
  onClick: () => void;
  isSelected: boolean;
}

export function OffGameChatItem({ chat, onClick, isSelected }: OffGameChatItemProps): JSX.Element {
  // Determine chat display name
  const chatName =
    chat.type === 'group'
      ? chat.name || 'Gruppo Senza Nome'
      : chat.participants[0]?.name || 'Utente Sconosciuto';

  // Avatar letter (first char of name)
  const avatarLetter = chatName.charAt(0).toUpperCase();

  // Format timestamp
  const formatTimestamp = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h fa`;

    // Format as DD/MM
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div
      className={`${styles.chatItem} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={styles.avatar}>{avatarLetter}</div>

      {/* Chat Info */}
      <div className={styles.chatInfo}>
        <div className={styles.chatName}>
          {chat.type === 'group' ? '👥 ' : ''}
          {chatName}
          {chat.isMuted && <span className={styles.mutedIcon}>🔇</span>}
        </div>
        {chat.lastMessage && (
          <div className={styles.lastMessage}>
            {chat.lastMessage.messageType === 'system'
              ? '🔔 '
              : ''}
            {chat.lastMessage.content}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className={styles.chatMeta}>
        {chat.lastMessage && (
          <div className={styles.timestamp}>
            {formatTimestamp(chat.lastMessage.sentAt)}
          </div>
        )}
        {chat.unreadCount > 0 && (
          <div className={styles.unreadBadge}>
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
          </div>
        )}
      </div>
    </div>
  );
}
