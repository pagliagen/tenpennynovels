'use client';

import { useCallback } from 'react';
import { useForumBookmarks, useToggleBookmark } from '@/hooks/useForumSocial';
import { useForumStore } from '@/store/forumStore';
import type { ForumBookmark } from '@/types/forum';
import styles from '@/styles/components/forum/BookmarksView.module.scss';

const TRUNCATE_LEN = 120;

export function BookmarksView(): JSX.Element {
  const { data: bookmarks = [], isLoading, error } = useForumBookmarks();
  const toggleBookmark = useToggleBookmark();
  const { navigateToPost, navigateToThread } = useForumStore();

  const handleBookmarkClick = useCallback(
    (b: ForumBookmark) => {
      if (!b.topicSlug || !b.discussionSlug) return;
      if (b.itemType === 'post') {
        navigateToPost(b.topicSlug, b.discussionSlug, b.itemId);
      } else {
        navigateToThread(b.topicSlug, b.discussionSlug);
      }
    },
    [navigateToPost, navigateToThread]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent, postId: string) => {
      e.stopPropagation();
      toggleBookmark.mutate(postId);
    },
    [toggleBookmark]
  );

  const getSnippet = (b: ForumBookmark): string => {
    if (b.itemType === 'post' && b.post?.content) {
      const raw = b.post.content.replace(/<[^>]+>/g, '');
      return raw.length > TRUNCATE_LEN ? raw.slice(0, TRUNCATE_LEN) + '…' : raw;
    }
    if (b.itemType === 'discussion' && b.discussion?.title) {
      return b.discussion.title;
    }
    return 'Contenuto non disponibile';
  };

  const getAuthor = (b: ForumBookmark): string => {
    if (b.itemType === 'post' && b.post?.author) {
      return b.post.author.characterName;
    }
    if (b.itemType === 'discussion' && b.discussion?.createdBy) {
      return b.discussion.createdBy.characterName;
    }
    return '—';
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (error) {
    return (
      <div className={styles.empty}>
        Errore nel caricamento dei segnalibri.
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return <div className={styles.empty}>Non hai ancora salvato nessun segnalibro</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {bookmarks.map((b) => (
          <article
            key={b._id}
            className={styles.bookmarkItem}
            onClick={() => handleBookmarkClick(b)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleBookmarkClick(b)}
          >
            <div className={styles.postContent}>{getSnippet(b)}</div>
            <div className={styles.meta}>
              <span>di {getAuthor(b)}</span>
              {b.topicSlug && b.discussionSlug && (
                <span className={styles.path}>
                  {b.topicSlug} › {b.discussionSlug}
                </span>
              )}
            </div>
            {b.itemType === 'post' && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(e) => handleRemove(e, b.itemId)}
                aria-label="Rimuovi segnalibro"
              >
                Rimuovi
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
