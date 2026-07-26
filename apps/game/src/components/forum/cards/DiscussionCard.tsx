'use client';

import { useToggleDiscussionFavorite } from '@/hooks/useForumDiscussions';
import { useForumStore } from '@/store/forumStore';
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

  const handleClick = () => {
    if (!discussion.isLocked) {
      navigateToThread(discussion.topicSlug, discussion.slug);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite.mutate({ topicSlug: discussion.topicSlug, discussionSlug: discussion.slug });
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
        <h3 className={styles.title}>{discussion.title}</h3>
        {(discussion.isPinned || discussion.isLocked) && (
          <div className={styles.badges}>
            {discussion.isPinned && <span className={styles.pinnedBadge}>In evidenza</span>}
            {discussion.isLocked && <span className={styles.badge}>Chiusa</span>}
          </div>
        )}
        <button
          type="button"
          className={`${styles.favoriteBtn} ${discussion.isFavorite ? styles.favoriteActive : ''}`}
          onClick={handleFavoriteClick}
          aria-label={discussion.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          ★
        </button>
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
        <span>di {discussion.createdBy.characterName}</span>
        <span>{formatDate(discussion.createdAt)}</span>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat}>{discussion.postCount} messaggi</span>
        <span className={styles.stat}>{discussion.viewCount} visualizzazioni</span>
        {discussion.subscriberCount > 0 && (
          <span className={styles.stat}>{discussion.subscriberCount} iscritti</span>
        )}
      </div>
      {(discussion.lastPostBy || discussion.lastPostAt) && (
        <div className={styles.lastPost}>
          Ultimo: {discussion.lastPostBy?.characterName || '—'} ·{' '}
          {formatDate(discussion.lastPostAt)}
        </div>
      )}
    </article>
  );
}
