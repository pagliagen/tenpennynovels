/**
 * OnGame Thread Component
 *
 * Displays a conversation thread with Victorian postal aesthetics
 * Shows sent/delivered/scheduled messages
 */

import { useOnGameThread, useDeleteOnGameMessage } from '@/hooks/useOnGameMessages';
import { useAuthStore } from '@/store/authStore';
import type { OnGameMessage } from '@/lib/api/onGameMessages';
import styles from './OnGameThread.module.scss';

interface OnGameThreadProps {
  threadId: string;
  onBack: () => void;
  onReply: (messageId?: string, subject?: string) => void;
}

export function OnGameThread({ threadId, onBack, onReply }: OnGameThreadProps) {
  const { data, isLoading, error } = useOnGameThread(threadId);
  const { mutate: deleteMessage } = useDeleteOnGameMessage();
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Caricamento conversazione...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.error}>
        <p>Errore nel caricamento della conversazione</p>
        <button onClick={onBack}>Torna indietro</button>
      </div>
    );
  }

  const isSentByMe = (message: OnGameMessage) => {
    return message.senderId === selectedCharacter?._id;
  };

  const canDelete = (message: OnGameMessage) => {
    if (!selectedCharacter) return false;

    // Sender can delete if sent < 5 min ago (unless master)
    if (isSentByMe(message)) {
      const sentAt = new Date(message.sentAt).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return now - sentAt < fiveMinutes; // TODO: Check if master
    }

    // Recipient can always delete
    return message.recipientId === selectedCharacter._id;
  };

  const handleDelete = (messageId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo messaggio?')) {
      deleteMessage(messageId);
    }
  };

  const getMessageStatus = (message: OnGameMessage) => {
    if (message.deliveredAt) {
      return 'delivered';
    }
    if (message.scheduledDelivery) {
      return 'scheduled';
    }
    return 'sent';
  };

  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          ← Indietro
        </button>
        <h2>Conversazione</h2>
        <button onClick={() => onReply()} className={styles.replyButton}>
          Rispondi
        </button>
      </div>

      <div className={styles.messagesList}>
        {data.messages.map((message) => {
          const status = getMessageStatus(message);
          const sentByMe = isSentByMe(message);

          return (
            <div
              key={message._id}
              className={`${styles.message} ${sentByMe ? styles.sentByMe : styles.receivedByMe} ${
                styles[status]
              }`}
            >
              <div className={styles.messageHeader}>
                <div className={styles.messageType}>{message.deliveryConfig.displayName}</div>
                <div className={styles.messageDate}>
                  {new Date(
                    message.deliveredAt || message.scheduledDelivery || message.sentAt
                  ).toLocaleString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className={styles.messageSubject}>
                <strong>Oggetto:</strong> {message.subject}
              </div>

              <div className={styles.messageContent}>{message.content}</div>

              <div className={styles.messageFooter}>
                <div className={styles.messageStatus}>
                  {status === 'scheduled' && (
                    <span className={styles.statusScheduled}>
                      ⏱️ Consegna programmata:{' '}
                      {new Date(message.scheduledDelivery!).toLocaleString('it-IT')}
                    </span>
                  )}
                  {status === 'sent' && (
                    <span className={styles.statusSent}>📨 Inviato</span>
                  )}
                  {status === 'delivered' && (
                    <span className={styles.statusDelivered}>✅ Consegnato</span>
                  )}
                </div>

                <div className={styles.messageActions}>
                  {message.deliveryConfig.canReply && !sentByMe && status === 'delivered' && (
                    <button
                      onClick={() => onReply(message._id, `Re: ${message.subject}`)}
                      className={styles.actionButton}
                    >
                      Rispondi
                    </button>
                  )}

                  {canDelete(message) && (
                    <button
                      onClick={() => handleDelete(message._id)}
                      className={styles.actionButtonDanger}
                    >
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
