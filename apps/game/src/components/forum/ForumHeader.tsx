'use client';

import { useState, useEffect, FormEvent } from 'react';

import { useForumCategories } from '@/hooks/useForumCategories';
import { useForumDiscussion } from '@/hooks/useForumDiscussions';
import { useForumTopic } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/ForumHeader.module.scss';

interface ForumHeaderProps {
  onClose: () => void;
}

export function ForumHeader({ onClose }: ForumHeaderProps): JSX.Element {
  const {
    view,
    categorySlug,
    topicSlug,
    discussionSlug,
    searchQuery,
    navigateToCategories,
    navigateToDiscussions,
    navigateToSearch,
    navigateToBookmarks,
    navigateToNotifications,
    navigateToCreateDiscussion,
    collapseForum,
  } = useForumStore();

  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const { data: categories = [] } = useForumCategories();
  const { data: topic } = useForumTopic(topicSlug);
  const { data: discussion } = useForumDiscussion(topicSlug, discussionSlug);

  const categoryTitle = categorySlug ? categories.find((c) => c.slug === categorySlug)?.title : undefined;
  const topicTitle = topic?.title ?? topicSlug ?? '';
  const discussionTitle = discussion?.title ?? discussionSlug ?? '';

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    navigateToSearch(q || undefined);
  };

  const showNewDiscussionBtn = view === 'discussions' && topicSlug;

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={collapseForum}
        title="Riduci a icona"
        aria-label="Riduci la bacheca a icona"
      >
        ▶
      </button>

      <nav className={styles.breadcrumb} aria-label="Navigazione">
        <button
          type="button"
          className={styles.breadcrumbLink}
          onClick={navigateToCategories}
          aria-label="Torna alla bacheca"
        >
          Home
        </button>

        {view === 'topics' && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>
              {categorySlug ? (categoryTitle || categorySlug) : 'Tutti gli argomenti'}
            </span>
          </>
        )}

        {topicSlug && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <button
              type="button"
              className={styles.breadcrumbLink}
              onClick={() => navigateToDiscussions(topicSlug)}
            >
              {topicTitle || topicSlug}
            </button>
          </>
        )}

        {discussionSlug && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>{discussionTitle || discussionSlug}</span>
          </>
        )}

        {view === 'search' && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>Cerca</span>
          </>
        )}

        {view === 'bookmarks' && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>Segnalibri</span>
          </>
        )}

        {view === 'notifications' && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>Notifiche</span>
          </>
        )}

        {view === 'createDiscussion' && (
          <>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbCurrent}>Nuova discussione</span>
          </>
        )}
      </nav>

      <form className={styles.searchForm} onSubmit={handleSearchSubmit} role="search">
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Cerca nella bacheca..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Cerca discussioni e post"
        />
      </form>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={navigateToBookmarks}
          title="Segnalibri"
          aria-label="Vai ai segnalibri"
        >
          📑
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={navigateToNotifications}
          title="Notifiche"
          aria-label="Vai alle notifiche"
        >
          🔔
        </button>

        {showNewDiscussionBtn && (
          <button
            type="button"
            className={styles.newDiscussionBtn}
            onClick={() => topicSlug && navigateToCreateDiscussion(topicSlug)}
          >
            Nuova Discussione
          </button>
        )}

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          title="Chiudi"
          aria-label="Chiudi bacheca"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
