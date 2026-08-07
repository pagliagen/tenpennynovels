'use client';

import { useForumCategories } from '@/hooks/useForumCategories';
import { useForumUnreadSummary } from '@/hooks/useForumPreferences';
import { useForumTopics } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/TopicListView.module.scss';

import { TopicCard } from '../cards/TopicCard';

export function TopicListView() {
  const { data: allTopics = [], isLoading, error } = useForumTopics();
  const { data: categories = [] } = useForumCategories();
  const { data: unreadSummary } = useForumUnreadSummary();
  const categorySlug = useForumStore((s) => s.categorySlug);
  const navigateToCategories = useForumStore((s) => s.navigateToCategories);

  const unreadTopicSlugs = new Set(unreadSummary?.topics.map((t) => t.slug) ?? []);

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        Errore nel caricamento della bacheca. Riprova più tardi.
      </div>
    );
  }

  const topics = categorySlug
    ? allTopics.filter((t) => t.categorySlug === categorySlug)
    : allTopics;

  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;
  const totalDiscussions = topics.reduce((sum, t) => sum + t.discussionCount, 0);
  const totalPosts = topics.reduce((sum, t) => sum + t.postCount, 0);

  return (
    <div className={styles.container}>
      <button type="button" className={styles.backLink} onClick={navigateToCategories}>
        ← Categorie
      </button>
      <h1 className={styles.title}>{category?.title ?? 'Tutti gli argomenti'}</h1>
      <p className={styles.subtitle}>
        {totalDiscussions} discussioni · {totalPosts} messaggi
      </p>
      {topics.length === 0 ? (
        <div className={styles.empty}>Nessun contenuto</div>
      ) : (
        <div className={styles.grid}>
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} hasUnread={unreadTopicSlugs.has(topic.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
