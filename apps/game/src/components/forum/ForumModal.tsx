'use client';

import { useEffect, useCallback, useState } from 'react';

import { useIsCompactLayout } from '@/hooks/useIsCompactLayout';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/ForumModal.module.scss';

import { ForumHeader } from './ForumHeader';
import { BookmarksView } from './views/BookmarksView';
import { CategoryListView } from './views/CategoryListView';
import { CreateDiscussionView } from './views/CreateDiscussionView';
import { DiscussionListView } from './views/DiscussionListView';
import { SearchResultsView } from './views/SearchResultsView';
import { ThreadView } from './views/ThreadView';
import { TopicListView } from './views/TopicListView';


const ANIMATION_DURATION = 400; // ms, must match .closing animation duration in ForumModal.module.scss

export function ForumModal(): JSX.Element | null {
  const { isOpen, isCollapsed, view, closeForum, expandForum, syncWithUrl } = useForumStore();
  const [isClosing, setIsClosing] = useState(false);
  const isCompactLayout = useIsCompactLayout();

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

  if (isCollapsed) {
    // Layout compatto: niente striscia laterale (non c'è più spazio riservato
    // a destra sotto COMPACT_LAYOUT_BREAKPOINT, la bacheca è a schermo intero
    // quando aperta). Lo stato "ridotta" resta comunque isCollapsed:true - il
    // bottone Bacheca in topbar (openForum) la riespande dove stava, invariato.
    if (isCompactLayout) return null;

    return (
      <button
        type="button"
        className={styles.collapsedStrip}
        onClick={expandForum}
        title="Espandi la bacheca"
        aria-label="Espandi la bacheca"
      >
        <span className={styles.collapsedIcon}>◀</span>
        <span className={styles.collapsedLabel}>Bacheca</span>
      </button>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'categories':
        return <CategoryListView />;
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
      default:
        return <CategoryListView />;
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
