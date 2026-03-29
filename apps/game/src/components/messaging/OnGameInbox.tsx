/**
 * OnGame Inbox Component
 *
 * Lists all on-game message threads with Victorian postal aesthetics
 * Uses NEW backend schema (participants array, unreadCount map)
 */

import { useState } from 'react';
import { useOnGameThreads } from '@/hooks/useOnGameMessages';
import { useAuthStore } from '@/store/authStore';
import type { OnGameThread } from '@/lib/api/onGameMessages';
import styles from './OnGameInbox.module.scss';

interface OnGameInboxProps {
  onThreadSelect: (threadId: string, partnerName: string) => void;
  onCompose: () => void;
}

export function OnGameInbox({ onThreadSelect, onCompose }: OnGameInboxProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useOnGameThreads(page, 25);
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Caricamento posta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Errore nel caricamento della posta</p>
        <button onClick={() => setPage(1)}>Riprova</button>
      </div>
    );
  }

  if (!data || data.threads.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📬</div>
        <h3>Nessun messaggio</h3>
        <p>La tua cassetta postale vittoriana è vuota.</p>
        <button onClick={onCompose} className={styles.composeButton}>
          Scrivi un messaggio
        </button>
      </div>
    );
  }

  // Get partner character from thread participants (already populated by backend)
  const getPartner = (thread: OnGameThread) => {
    return thread.participants.find((p) => p._id !== selectedCharacter?._id);
  };

  // Format partner display name
  const formatPartnerName = (partner?: { name: string; surname?: string }) => {
    if (!partner) return 'Sconosciuto';
    return partner.surname ? `${partner.name} ${partner.surname}` : partner.name;
  };

  const getUnreadCount = (thread: OnGameThread) => {
    if (!selectedCharacter) return 0;
    return thread.unreadCount[selectedCharacter._id] || 0;
  };

  return (
    <div className={styles.inbox}>
      <div className={styles.header}>
        <h2>Posta in Arrivo</h2>
        <button onClick={onCompose} className={styles.composeButton}>
          <span className={styles.icon}>✉️</span>
          Nuovo Messaggio
        </button>
      </div>

      <div className={styles.threadList}>
        {data.threads.map((thread) => {
          const partner = getPartner(thread);
          const partnerName = formatPartnerName(partner);
          const unread = getUnreadCount(thread);

          return (
            <div
              key={thread._id}
              className={`${styles.threadItem} ${unread > 0 ? styles.unread : ''}`}
              onClick={() => onThreadSelect(thread._id, partnerName)}
            >
              <div className={styles.threadHeader}>
                <div className={styles.threadSubject}>
                  {unread > 0 && <span className={styles.newIndicator}>NUOVO</span>}
                  {thread.lastMessageSubject || '(Nessun oggetto)'}
                </div>
                <div className={styles.threadDate}>
                  {new Date(thread.lastMessageAt).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div className={styles.threadPreview}>{thread.lastMessagePreview}</div>

              {unread > 0 && <div className={styles.unreadBadge}>{unread}</div>}
            </div>
          );
        })}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage(page - 1)}
            disabled={!data.pagination.hasPreviousPage}
            className={styles.pageButton}
          >
            ← Precedente
          </button>

          <span className={styles.pageInfo}>
            Pagina {data.pagination.currentPage} di {data.pagination.totalPages}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={!data.pagination.hasNextPage}
            className={styles.pageButton}
          >
            Successiva →
          </button>
        </div>
      )}
    </div>
  );
}
