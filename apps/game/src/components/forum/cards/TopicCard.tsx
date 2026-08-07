'use client';

import { useToggleFavorite } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/TopicCard.module.scss';
import type { ForumTopic, TopicAccessRule } from '@/types/forum';

interface TopicCardProps {
  topic: ForumTopic;
  onFavoriteToggle?: (slug: string) => void;
  hasUnread?: boolean;
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

function getAccessBadges(accessRules: TopicAccessRule[]): string[] {
  const publicRule = accessRules.find((r) => r.type === 'public');
  if (publicRule) return [];
  return accessRules.map((r) => r.label || r.type).filter(Boolean);
}

export function TopicCard({ topic, onFavoriteToggle, hasUnread }: TopicCardProps) {
  const navigateToDiscussions = useForumStore((s) => s.navigateToDiscussions);
  const toggleFavorite = useToggleFavorite();

  const handleClick = () => {
    navigateToDiscussions(topic.slug);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle(topic.slug);
    } else {
      toggleFavorite.mutate(topic.slug);
    }
  };

  const badges = getAccessBadges(topic.accessRules || []);

  return (
    <article
      className={styles.card}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>{topic.title}</h2>
          {(hasUnread || badges.length > 0 || topic.mode) && (
            <div className={styles.badges}>
              {hasUnread && <span className={styles.unreadBadge}>Nuove risposte</span>}
              {topic.mode && (
                <span className={styles.badge} title={topic.mode === 'ON' ? 'In gioco' : 'Fuori gioco'}>
                  {topic.mode}
                </span>
              )}
              {badges.map((label) => (
                <span key={label} className={styles.badge}>
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`${styles.favoriteBtn} ${topic.isFavorite ? styles.favoriteActive : ''}`}
          onClick={handleFavoriteClick}
          aria-label={topic.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          ★
        </button>
      </div>
      {topic.description && (
        <p className={styles.description}>{topic.description}</p>
      )}
      <div className={styles.meta}>
        <span>
          {topic.discussionCount} discussion{topic.discussionCount !== 1 ? 'i' : 'e'} · {topic.postCount} messagg{topic.postCount !== 1 ? 'i' : 'io'}
        </span>
        {(topic.lastPostBy || topic.lastPostAt) && (
          <span>
            Ultimo: {topic.lastPostBy?.characterName || '—'}
            {topic.lastDiscussionTitle && <> in {topic.lastDiscussionTitle}</>}
            {' · '}{formatDate(topic.lastPostAt)}
          </span>
        )}
      </div>
    </article>
  );
}
