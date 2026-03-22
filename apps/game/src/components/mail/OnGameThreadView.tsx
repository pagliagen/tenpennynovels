/**
 * OnGame Thread View Component
 *
 * Conversation view with message list + reply form.
 * Auto-scrolls to bottom on mount and new messages.
 *
 * @module components/mail/OnGameThreadView
 * @since 2.0.0
 */

'use client';

import { useEffect, useRef } from 'react';

import { useOnGameThread } from '@/hooks/useOnGameMail';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

import { OnGameMessageItem } from './OnGameMessageItem';
import { OnGameReplyForm } from './OnGameReplyForm';

interface OnGameThreadViewProps {
  partnerId: string;
  partnerName: string;
  onBack: () => void;
}

export function OnGameThreadView({
  partnerId,
  partnerName,
  onBack,
}: OnGameThreadViewProps): JSX.Element {
  const { data, isLoading, error, refetch } = useOnGameThread(partnerId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (data?.messages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [data?.messages]);

  const handleReplySent = () => {
    refetch();
  };

  return (
    <div className={styles.threadView}>
      {/* Header */}
      <div className={styles.threadHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          title="Torna alla lista"
        >
          ←
        </button>
        <h2 className={styles.threadHeaderTitle}>{partnerName}</h2>
      </div>

      {/* Messages list */}
      <div className={styles.messagesList}>
        {isLoading && <div className={styles.loading}>Caricamento...</div>}

        {error && (
          <div className={styles.error}>
            Errore nel caricamento della conversazione: {error.message}
          </div>
        )}

        {!isLoading &&
          !error &&
          data?.messages.map((message) => (
            <OnGameMessageItem
              key={message._id}
              message={message}
              isSentByMe={message.isSentByMe}
            />
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply form */}
      {!isLoading && !error && data && (
        <OnGameReplyForm
          partnerId={partnerId}
          partnerName={partnerName}
          lastSubject={data.messages[data.messages.length - 1]?.subject}
          onReplySent={handleReplySent}
        />
      )}
    </div>
  );
}
