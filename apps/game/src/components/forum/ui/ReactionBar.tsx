'use client';

import { useToggleReaction } from '@/hooks/useForumPosts';
import { useForumStore } from '@/store/forumStore';
import type { ReactionCounts, ReactionType } from '@/types/forum';
import styles from '@/styles/components/forum/ReactionBar.module.scss';

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'laugh', emoji: '😂' },
  { type: 'think', emoji: '🤔' },
];

interface ReactionBarProps {
  postId: string;
  reactionCounts: ReactionCounts;
}

export function ReactionBar({ postId, reactionCounts }: ReactionBarProps): JSX.Element {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const discussionSlug = useForumStore((s) => s.discussionSlug);
  const toggleReaction = useToggleReaction();

  const handleClick = (reactionType: ReactionType) => {
    if (!topicSlug || !discussionSlug) return;
    toggleReaction.mutate({ postId, reactionType, topicSlug, discussionSlug });
  };

  return (
    <div className={styles.reactionBar}>
      {REACTIONS.map(({ type, emoji }) => {
        const count = reactionCounts[type] ?? 0;
        const isActive = false; // TODO: track from API when user has reacted
        return (
          <button
            key={type}
            type="button"
            className={`${styles.reactionBtn} ${isActive ? styles.active : ''}`}
            onClick={() => handleClick(type)}
            disabled={toggleReaction.isPending}
            title={type}
          >
            <span className={styles.emoji}>{emoji}</span>
            {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
