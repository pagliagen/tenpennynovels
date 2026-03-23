'use client';

import { useCallback } from 'react';

import { useForumSearch } from '@/hooks/useForumSocial';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/SearchResultsView.module.scss';
import type { ForumSearchResult } from '@/types/forum';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SearchResultsView(): JSX.Element {
  const { searchQuery, setSearchQuery, navigateToPost } = useForumStore();
  const { data, isLoading, error } = useForumSearch(searchQuery);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  const handleResultClick = useCallback(
    (r: ForumSearchResult) => {
      navigateToPost(r.topicSlug, r.discussionSlug, r.id);
    },
    [navigateToPost]
  );

  const items = data?.list ?? [];

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (error) {
    return (
      <div className={styles.empty}>
        Errore nella ricerca. Riprova più tardi.
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          type="search"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder="Cerca nel forum..."
          className={styles.searchInput}
          autoFocus
        />
      </div>
      <div className={styles.results}>
        {items.length === 0 ? (
          <div className={styles.empty}>Nessun risultato per la ricerca</div>
        ) : (
          items.map((r) => (
            <article
              key={r.id}
              className={styles.resultCard}
              onClick={() => handleResultClick(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleResultClick(r)}
            >
              <div className={styles.contentSnippet}>
                {r.content.length > 200 ? r.content.slice(0, 200) + '…' : r.content}
              </div>
              <div className={styles.path}>
                {r.topicSlug} › {r.discussionSlug}
              </div>
              <div className={styles.meta}>
                <span>di {r.author.characterName}</span>
                <span>{formatDate(r.createdAt)}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
