'use client';

import { useForumTopics } from '@/hooks/useForumTopics';
import { TopicCard } from '../cards/TopicCard';
import styles from '@/styles/components/forum/TopicListView.module.scss';

export function TopicListView() {
  const { data: topics = [], isLoading, error } = useForumTopics();

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

  if (topics.length === 0) {
    return <div className={styles.empty}>Nessun contenuto</div>;
  }

  const totalDiscussions = topics.reduce((sum, t) => sum + t.discussionCount, 0);
  const totalPosts = topics.reduce((sum, t) => sum + t.postCount, 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Bacheca</h1>
      <p className={styles.subtitle}>
        {totalDiscussions} discussioni · {totalPosts} messaggi
      </p>
      <div className={styles.grid}>
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  );
}
