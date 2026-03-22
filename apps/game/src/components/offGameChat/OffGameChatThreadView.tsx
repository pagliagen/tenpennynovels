/**
 * OffGame Chat Thread View Component
 *
 * Conversation view with message list, typing indicator, and message input.
 * Auto-scrolls to bottom on mount and new messages.
 *
 * @module components/offGameChat/OffGameChatThreadView
 * @since 2.0.0
 */

'use client';

import { useEffect, useRef } from 'react';

import { useOffGameChat, useSendOffGameMessage, useOffGameChatWebSocket } from '@/hooks/useOffGameChat';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

import { MessageInput } from './MessageInput';
import { OffGameMessageItem } from './OffGameMessageItem';
import { TypingIndicator } from './TypingIndicator';

interface OffGameChatThreadViewProps {
  chatId: string;
  onBack: () => void;
}

export function OffGameChatThreadView({
  chatId,
  onBack,
}: OffGameChatThreadViewProps): JSX.Element {
  const { data, isLoading, error } = useOffGameChat(chatId);
  const sendMessage = useSendOffGameMessage();
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const { typingUsers } = useOffGameChatWebSocket(chatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (data?.messages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [data?.messages]);

  // Get typing users for this chat
  const chatTypingUsers = Array.from(typingUsers.get(chatId) || []);

  // Determine chat name
  const chatName =
    data?.chat.type === 'group'
      ? data.chat.name || 'Gruppo'
      : data?.chat.participants[0]?.name || 'Chat';

  // Handle send message
  const handleSend = (content: string) => {
    sendMessage.mutate({
      chatId,
      payload: { content },
    });
  };

  return (
    <div className={styles.threadView}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} title="Torna alla lista">
          ←
        </button>
        <h2 className={styles.title}>
          {data?.chat.type === 'group' ? '👥 ' : ''}
          {chatName}
          {data?.chat.type === 'group' && (
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
              ({data.chat.participants.length} partecipanti)
            </span>
          )}
        </h2>
      </div>

      {/* Messages List */}
      <div className={styles.messagesList}>
        {isLoading && <div className={styles.loading}>Caricamento messaggi...</div>}

        {error && (
          <div className={styles.error}>
            Errore nel caricamento dei messaggi: {error.message}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {data.messages.length === 0 && (
              <div className={styles.empty}>
                <p>Nessun messaggio ancora</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.7 }}>
                  Inizia la conversazione!
                </p>
              </div>
            )}

            {data.messages.map((message) => (
              <OffGameMessageItem
                key={message._id}
                message={message}
                isSentByMe={message.senderId === selectedCharacter?._id}
                showSenderName={data.chat.type === 'group'}
              />
            ))}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing Indicator */}
      {chatTypingUsers.length > 0 && <TypingIndicator typingUsers={chatTypingUsers} />}

      {/* Message Input */}
      {!isLoading && !error && data && (
        <MessageInput
          chatId={chatId}
          onSend={handleSend}
          disabled={sendMessage.isPending}
        />
      )}
    </div>
  );
}
