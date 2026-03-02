/**
 * OffGame Chat List View Component
 *
 * Chat list view with action buttons (New Chat, New Group).
 * Shows all user's chats sorted by last activity.
 *
 * @module components/offGameChat/OffGameChatListView
 * @since 2.0.0
 */

'use client';

import { useOffGameChats } from '@/hooks/useOffGameChat';
import { OffGameChatItem } from './OffGameChatItem';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface OffGameChatListViewProps {
  onChatSelect: (chatId: string) => void;
  onNewChat: (type: 'direct' | 'group') => void;
}

export function OffGameChatListView({
  onChatSelect,
  onNewChat,
}: OffGameChatListViewProps): JSX.Element {
  const { data: chats = [], isLoading, error } = useOffGameChats();

  return (
    <>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Chat OFF-GAME</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.actionButton} onClick={() => onNewChat('direct')}>
            👤 Nuova Chat
          </button>
          <button className={styles.actionButton} onClick={() => onNewChat('group')}>
            👥 Nuovo Gruppo
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className={styles.chatList}>
        {isLoading && <div className={styles.loading}>Caricamento chat...</div>}

        {error && (
          <div className={styles.error}>
            Errore nel caricamento delle chat: {error.message}
          </div>
        )}

        {!isLoading && !error && chats.length === 0 && (
          <div className={styles.empty}>
            <p>Nessuna chat trovata</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.7 }}>
              Crea una nuova chat per iniziare a comunicare
            </p>
          </div>
        )}

        {!isLoading &&
          !error &&
          chats.map((chat) => (
            <OffGameChatItem
              key={chat._id}
              chat={chat}
              onClick={() => onChatSelect(chat._id)}
              isSelected={false}
            />
          ))}
      </div>
    </>
  );
}
