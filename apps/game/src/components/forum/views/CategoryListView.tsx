'use client';

import { useForumCategories } from '@/hooks/useForumCategories';
import { useForumUnreadSummary } from '@/hooks/useForumPreferences';
import { useForumTopics } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/CategoryListView.module.scss';

import { TopicCard } from '../cards/TopicCard';

export function CategoryListView() {
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useForumCategories();
  const { data: topics = [], isLoading: topicsLoading, error: topicsError } = useForumTopics();
  const { data: unreadSummary } = useForumUnreadSummary();
  const navigateToTopicsInCategory = useForumStore((s) => s.navigateToTopicsInCategory);

  const unreadTopicSlugs = new Set(unreadSummary?.topics.map((t) => t.slug) ?? []);

  const isLoading = categoriesLoading || topicsLoading;
  const error = categoriesError || topicsError;

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

  const groups = categories
    .map((category) => ({
      category,
      topics: topics.filter((t) => t.categorySlug === category.slug),
    }))
    .filter((group) => group.topics.length > 0);

  const uncategorizedTopics = topics.filter((t) => !t.categorySlug);
  const isEmpty = groups.length === 0 && uncategorizedTopics.length === 0;

  return (
    <div className={styles.container}>
      {isEmpty ? (
        <div className={styles.empty}>Nessun argomento disponibile</div>
      ) : (
        <>
          {groups.map(({ category, topics: categoryTopics }) => (
            <section key={category.id} className={styles.categoryGroup}>
              <button
                type="button"
                className={styles.categoryHeader}
                onClick={() => navigateToTopicsInCategory(category.slug)}
              > 
                <h2 className={styles.categoryTitle}>{category.title}</h2>
              </button>
              <div className={styles.grid}>
                {categoryTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} hasUnread={unreadTopicSlugs.has(topic.slug)} />
                ))}
              </div>
            </section>
          ))}

          {uncategorizedTopics.length > 0 && (
            <section className={styles.categoryGroup}>
              <h2 className={styles.categoryTitle}>Senza categoria</h2>
              <div className={styles.grid}>
                {uncategorizedTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} hasUnread={unreadTopicSlugs.has(topic.slug)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
