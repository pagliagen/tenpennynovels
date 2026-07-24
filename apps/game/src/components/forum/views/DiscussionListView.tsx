'use client';

import { useState, useEffect } from 'react';

import { useForumDiscussions } from '@/hooks/useForumDiscussions';
import { useMarkTopicVisited } from '@/hooks/useForumPreferences';
import { useForumTopic } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/DiscussionListView.module.scss';

import { DiscussionCard } from '../cards/DiscussionCard';


export function DiscussionListView() {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const navigateToCreateDiscussion = useForumStore((s) => s.navigateToCreateDiscussion);
  const navigateToCategories = useForumStore((s) => s.navigateToCategories);

  const [page, setPage] = useState(1);
  const markTopicVisited = useMarkTopicVisited();

  useEffect(() => {
    setPage(1);
  }, [topicSlug]);

  useEffect(() => {
    if (topicSlug) {
      markTopicVisited.mutate(topicSlug);
    }
    // Only re-run when the topic changes - not on every markTopicVisited identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicSlug]);

  const { data, isLoading, error } = useForumDiscussions(topicSlug, page);
  const { data: topic } = useForumTopic(topicSlug);

  if (!topicSlug) {
    return (
      <div className={styles.empty}>
        Nessun argomento selezionato.{' '}
        <button type="button" className={styles.backLink} onClick={() => navigateToCategories()}>
          Torna alla bacheca
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (error) {
    return (
      <div className={styles.empty}>
        Errore nel caricamento delle discussioni. Riprova più tardi.
      </div>
    );
  }

  const items = data?.list ?? [];
  const pagination = data?.pagination;

  if (items.length === 0 && page === 1) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{topic?.title ?? topicSlug}</h1>
          <button
            type="button"
            className={styles.newBtn}
            onClick={() => navigateToCreateDiscussion(topicSlug)}
          >
            Nuova Discussione
          </button>
        </div>
        <div className={styles.empty}>Nessun contenuto</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{topic?.title ?? topicSlug}</h1>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => navigateToCreateDiscussion(topicSlug)}
        >
          Nuova Discussione
        </button>
      </div>
      <div className={styles.list}>
        {items.map((discussion) => (
          <DiscussionCard key={discussion.id} discussion={discussion} />
        ))}
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!pagination.hasPrev}
          >
            ← Precedente
          </button>
          <span className={styles.pageInfo}>
            Pagina {pagination.page} di {pagination.totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNext}
          >
            Successiva →
          </button>
        </div>
      )}
    </div>
  );
}
