'use client';

import { useToggleDiscussionFavorite, useUpdateDiscussion } from '@/hooks/useForumDiscussions';
import { useAuthStore } from '@/store/authStore';
import { useForumStore } from '@/store/forumStore';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/DiscussionCard.module.scss';
import type { ForumDiscussion } from '@/types/forum';

interface DiscussionCardProps {
  discussion: ForumDiscussion;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DiscussionCard({ discussion }: DiscussionCardProps) {
  const navigateToThread = useForumStore((s) => s.navigateToThread);
  const toggleFavorite = useToggleDiscussionFavorite();
  const updateDiscussion = useUpdateDiscussion();
  const addToast = useUIStore((s) => s.addToast);
  // Proxy for "might be staff" - same flag ThreadView/PostCard use to show/hide
  // moderation controls. Real authorization (forum.manage) is always enforced server-side.
  const canModerate = useAuthStore((s) => s.adminPanelAccessFromSession);

  const handleClick = () => {
    if (!discussion.isLocked) {
      navigateToThread(discussion.topicSlug, discussion.slug);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite.mutate({ topicSlug: discussion.topicSlug, discussionSlug: discussion.slug });
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDiscussion.mutate(
      { topicSlug: discussion.topicSlug, discussionSlug: discussion.slug, data: { isLocked: !discussion.isLocked } },
      {
        onSuccess: () => addToast({
          type: 'success',
          message: discussion.isLocked ? 'Discussione riaperta' : 'Discussione chiusa',
        }),
        onError: () => addToast({ type: 'error', message: 'Impossibile aggiornare la discussione' }),
      }
    );
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDiscussion.mutate(
      { topicSlug: discussion.topicSlug, discussionSlug: discussion.slug, data: { isPinned: !discussion.isPinned } },
      {
        onSuccess: () => addToast({
          type: 'success',
          message: discussion.isPinned ? 'Thread rimosso dai fissati' : 'Thread fissato',
        }),
        onError: () => addToast({ type: 'error', message: 'Impossibile aggiornare la discussione' }),
      }
    );
  };

  return (
    <article
      className={`${styles.card} ${discussion.isPinned ? styles.cardPinned : ''} ${discussion.isLocked ? styles.locked : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>
          {discussion.isPinned && <span className={styles.pinMarker}>📌</span>}
          {discussion.title}
        </h3>
        {discussion.isLocked && (
          <div className={styles.badges}>
            <span className={styles.badge}>Chiusa</span>
          </div>
        )}
        <div className={styles.actions}>
          {canModerate && (
            <button
              type="button"
              className={`${styles.iconBtn} ${discussion.isPinned ? styles.iconBtnActive : ''}`}
              onClick={handleTogglePin}
              disabled={updateDiscussion.isPending}
              aria-label={discussion.isPinned ? 'Rimuovi dai fissati' : 'Fissa il thread'}
              title={discussion.isPinned ? 'Rimuovi dai fissati' : 'Fissa il thread in cima alla lista'}
            >
              📌
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              className={`${styles.iconBtn} ${discussion.isLocked ? styles.iconBtnActive : ''}`}
              onClick={handleToggleLock}
              disabled={updateDiscussion.isPending}
              aria-label={discussion.isLocked ? 'Riapri la discussione' : 'Chiudi la discussione'}
              title={discussion.isLocked ? 'Riapri la discussione' : 'Chiudi la discussione (non si potrà più rispondere)'}
            >
              {discussion.isLocked ? '🔓' : '🔒'}
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${discussion.isFavorite ? styles.iconBtnActive : ''}`}
            onClick={handleFavoriteClick}
            aria-label={discussion.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            ★
          </button>
        </div>
      </div>
      {discussion.tags && discussion.tags.length > 0 && (
        <div className={styles.tags}>
          {discussion.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className={styles.meta}>
        <span>
          {discussion.postCount} messagg{discussion.postCount !== 1 ? 'i' : 'io'} · {discussion.viewCount} visualizzazioni
          {discussion.subscriberCount > 0 ? ` · ${discussion.subscriberCount} iscritti` : ''}
        </span>
        {(discussion.lastPostBy || discussion.lastPostAt) && (
          <span>
            Ultimo: {discussion.lastPostBy?.characterName || '—'} · {formatDate(discussion.lastPostAt)}
          </span>
        )}
      </div>
    </article>
  );
}
