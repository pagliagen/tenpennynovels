'use client';

import { useEffect, useCallback, useState } from 'react';
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

const ANIMATION_DURATION = 300; // ms

export function ForumModal(): JSX.Element | null {
  const { isOpen, view, closeForum, syncWithUrl } = useForumStore();
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeForum();
      router.push('/');
      setIsClosing(false);
    }, ANIMATION_DURATION);
  }, [closeForum, router]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

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
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ''}`} onClick={handleOverlayClick}>
      <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} role="dialog" aria-modal="true" aria-label="Bacheca">
        <ForumHeader onClose={handleClose} />
        <div className={styles.content}>{renderView()}</div>
      </div>
    </div>
  );
}
