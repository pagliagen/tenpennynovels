'use client';

import { useEffect, useCallback, useState } from 'react';

import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/ForumModal.module.scss';

import { ForumHeader } from './ForumHeader';
import { BookmarksView } from './views/BookmarksView';
import { CreateDiscussionView } from './views/CreateDiscussionView';
import { DiscussionListView } from './views/DiscussionListView';
import { NotificationsView } from './views/NotificationsView';
import { SearchResultsView } from './views/SearchResultsView';
import { ThreadView } from './views/ThreadView';
import { TopicListView } from './views/TopicListView';


const ANIMATION_DURATION = 300; // ms

export function ForumModal(): JSX.Element | null {
  const { isOpen, view, closeForum, syncWithUrl } = useForumStore();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeForum();
      // Clear hash to return to game page
      if (typeof window !== 'undefined') {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }
      setIsClosing(false);
    }, ANIMATION_DURATION);
  }, [closeForum]);

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
