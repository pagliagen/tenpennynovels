'use client';

import { useState, useCallback } from 'react';

import {
  useForumNotifications,
  useMarkAllNotificationsRead,
} from '@/hooks/useForumSocial';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/NotificationsView.module.scss';
import type { ForumNotification, ForumNotificationType } from '@/types/forum';

const NOTIF_ICONS: Record<ForumNotificationType, string> = {
  new_post_in_subscribed_discussion: '💬',
  reply_to_your_post: '↩️',
  staff_announcement: '📢',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsView(): JSX.Element {
  const [page] = useState(1);
  const { data, isLoading, error } = useForumNotifications(page);
  const markAllRead = useMarkAllNotificationsRead();
  const { navigateToPost, navigateToThread } = useForumStore();

  const handleNotificationClick = useCallback(
    (n: ForumNotification) => {
      if (n.topicSlug && n.discussionSlug) {
        if (n.relatedPostId) {
          navigateToPost(n.topicSlug, n.discussionSlug, n.relatedPostId);
        } else {
          navigateToThread(n.topicSlug, n.discussionSlug);
        }
      }
    },
    [navigateToPost, navigateToThread]
  );

  const handleMarkAll = useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  const items = data?.list ?? [];

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (error) {
    return (
      <div className={styles.empty}>
        Errore nel caricamento delle notifiche.
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notifiche</h2>
        {items.some((n) => !n.isRead) && (
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAll}
            disabled={markAllRead.isPending}
          >
            Segna tutte come lette
          </button>
        )}
      </div>
      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.empty}>Nessun risultato</div>
        ) : (
          items.map((n) => (
            <article
              key={n._id}
              className={`${styles.notification} ${!n.isRead ? styles.unread : ''}`}
              onClick={() => handleNotificationClick(n)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
            >
              <span className={styles.notifIcon}>{NOTIF_ICONS[n.type] ?? '•'}</span>
              <div className={styles.notifBody}>
                <div className={styles.notifTitle}>{n.title}</div>
                <div className={styles.notifMessage}>{n.message}</div>
                {(n.triggeredByCharacterName || n.createdAt) && (
                  <div className={styles.timestamp}>
                    {n.triggeredByCharacterName && (
                      <span>da {n.triggeredByCharacterName}</span>
                    )}
                    {n.createdAt && <span>{formatDate(n.createdAt)}</span>}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
