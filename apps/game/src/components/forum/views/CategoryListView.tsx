'use client';

import { useForumCategories } from '@/hooks/useForumCategories';
import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/CategoryListView.module.scss';

import { CategoryCard } from '../cards/CategoryCard';

export function CategoryListView() {
  const { data: categories = [], isLoading, error } = useForumCategories();
  const navigateToTopics = useForumStore((s) => s.navigateToTopics);

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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Bacheca</h1>

      <button type="button" className={styles.allTopicsLink} onClick={() => navigateToTopics()}>
        Vedi tutti gli argomenti →
      </button>

      {categories.length === 0 ? (
        <div className={styles.empty}>Nessuna categoria</div>
      ) : (
        <div className={styles.grid}>
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
