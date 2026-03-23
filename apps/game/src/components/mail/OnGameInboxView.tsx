/**
 * OnGame Inbox View Component
 *
 * Thread list view showing all conversations.
 * Header with compose button + scrollable thread list.
 *
 * @module components/mail/OnGameInboxView
 * @since 2.0.0
 */

'use client';

import { useOnGameThreads } from '@/hooks/useOnGameMail';
import styles from '@/styles/components/mail/OnGameMail.module.scss';

import { OnGameThreadItem } from './OnGameThreadItem';

interface OnGameInboxViewProps {
  onThreadSelect: (partnerId: string, partnerName: string) => void;
  onCompose: () => void;
}

export function OnGameInboxView({ onThreadSelect, onCompose }: OnGameInboxViewProps): JSX.Element {
  const { data: threads = [], isLoading, error } = useOnGameThreads();

  return (
    <div className={styles.inboxView}>
      {/* Header */}
      <div className={styles.inboxHeader}>
        <h2 className={styles.inboxTitle}>Posta Vittoriana</h2>
        <button
          type="button"
          className={styles.composeButton}
          onClick={onCompose}
          title="Scrivi nuovo messaggio"
        >
          ✉️
        </button>
      </div>

      {/* Thread list */}
      <div className={styles.threadsList}>
        {isLoading && <div className={styles.loading}>Caricamento...</div>}

        {error && (
          <div className={styles.error}>
            Errore nel caricamento dei messaggi: {error.message}
          </div>
        )}

        {!isLoading && !error && threads.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <p>Nessun messaggio</p>
            <p>Inizia una nuova conversazione!</p>
          </div>
        )}

        {!isLoading &&
          !error &&
          threads.map((thread) => (
            <OnGameThreadItem
              key={thread.partnerId}
              thread={thread}
              onClick={() => onThreadSelect(thread.partnerId, thread.partnerName)}
            />
          ))}
      </div>
    </div>
  );
}
