'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useForumStore } from '@/store/forumStore';
import { TopicListView } from './views/TopicListView';
import { DiscussionListView } from './views/DiscussionListView';
import { ThreadView } from './views/ThreadView';
import { CreateDiscussionView } from './views/CreateDiscussionView';
import { SearchResultsView } from './views/SearchResultsView';
import { BookmarksView } from './views/BookmarksView';
import { NotificationsView } from './views/NotificationsView';
import { ForumHeader } from './ForumHeader';
import styles from '@/styles/components/forum/ForumModal.module.scss';

export function ForumModal(): JSX.Element | null {
  const { isOpen, view, closeForum, syncWithUrl } = useForumStore();
  const router = useRouter();

  const handleClose = useCallback(() => {
    closeForum();
    router.push('/');
  }, [closeForum, router]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose]
  );

  useEffect(() => {
    syncWithUrl();
  }, [syncWithUrl]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const renderView = () => {
    switch (view) {
      case 'topics':
        return <TopicListView />;
      case 'discussions':
        return <DiscussionListView />;
      case 'thread':
        return <ThreadView />;
      case 'createDiscussion':
        return <CreateDiscussionView />;
      case 'search':
        return <SearchResultsView />;
      case 'bookmarks':
        return <BookmarksView />;
      case 'notifications':
        return <NotificationsView />;
      default:
        return <TopicListView />;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Bacheca">
        <ForumHeader onClose={handleClose} />
        <div className={styles.content}>{renderView()}</div>
      </div>
    </div>
  );
}
