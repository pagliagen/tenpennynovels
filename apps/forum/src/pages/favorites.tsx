import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/Favorites.module.scss';
import { ForumTopic, getUserFavoriteTopics, removeTopicFromFavorites } from '@/lib/forumApi';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface FavoritesPageProps {
  authContext: AuthContext;
}

export default function FavoritesPage({ authContext }: FavoritesPageProps) {
  const router = useRouter();
  const [favoriteTopics, setFavoriteTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    if (!authContext.isAuthenticated) {
      router.push('/');
      return;
    }
    
    loadFavoriteTopics();
  }, [authContext.isAuthenticated]);

  const loadFavoriteTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      const favorites = await getUserFavoriteTopics();
      setFavoriteTopics(favorites);
    } catch (err) {
      console.error('Failed to load favorite topics:', err);
      setError('Errore nel caricamento degli argomenti preferiti');
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topic: ForumTopic) => {
    router.push(`/${topic.slug}`);
  };

  const handleRemoveFavorite = async (event: React.MouseEvent, topic: ForumTopic) => {
    event.stopPropagation(); // Prevent navigation when clicking remove button
    
    try {
      await removeTopicFromFavorites(topic.slug);
      // Remove from local state
      setFavoriteTopics(prev => prev.filter(t => t.slug !== topic.slug));
    } catch (err) {
      console.error('Failed to remove topic from favorites:', err);
      // Could add a toast notification here
    }
  };

  const formatLastPost = (topic: ForumTopic) => {
    if (!topic.lastPostAt || !topic.lastPostBy) return 'Nessun post recente';
    
    const date = new Date(topic.lastPostAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    let timeAgo = '';
    if (diffDays > 0) {
      timeAgo = `${diffDays} giorni fa`;
    } else if (diffHours > 0) {
      timeAgo = `${diffHours} ore fa`;
    } else {
      timeAgo = 'Meno di un\'ora fa';
    }
    
    const byUser = topic.lastPostBy?.characterName || topic.lastPostBy?.username || 'Anonimo';
    
    return `${timeAgo} da ${byUser}`;
  };

  // Redirect if not authenticated
  if (!authContext.isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - I Miei Preferiti</title>
        <meta name="description" content="I tuoi argomenti preferiti del forum di TenpennyNovels" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.favoritesContainer}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>I Miei Preferiti</h2>
          <p className={styles.subtitle}>
            I tuoi argomenti preferiti del forum
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Caricamento preferiti...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button onClick={loadFavoriteTopics} className="btn btn-secondary">
              Riprova
            </button>
          </div>
        )}

        {/* Topics list */}
        {!loading && !error && (
          <div className={styles.topicsList}>
            {favoriteTopics.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>⭐</div>
                <h3>Nessun preferito</h3>
                <p>Non hai ancora aggiunto nessun argomento ai preferiti.</p>
                <button 
                  onClick={() => router.push('/')} 
                  className="btn btn-primary"
                >
                  Esplora il Forum
                </button>
              </div>
            ) : (
              favoriteTopics.map((topic) => (
                <div
                  key={topic.id}
                  className={`${styles.topicCard} ${topic.isPinned ? styles.pinnedTopic : ''} ${topic.isLocked ? styles.lockedTopic : ''}`}
                  onClick={() => handleTopicClick(topic)}
                >
                  <div className={styles.topicMain}>
                    <div className={styles.topicInfo}>
                      <div className={styles.topicHeader}>
                        <h3 className={styles.topicTitle}>
                          {topic.isPinned && <span className={styles.pinnedBadge}>📌</span>}
                          {topic.isLocked && <span className={styles.lockedBadge}>🔒</span>}
                          {!topic.isPublic && <span className={styles.privateBadge}>🔐</span>}
                          {topic.title}
                        </h3>
                        <button
                          onClick={(e) => handleRemoveFavorite(e, topic)}
                          className={styles.removeButton}
                          title="Rimuovi dai preferiti"
                        >
                          ❌
                        </button>
                      </div>
                      
                      {topic.description && (
                        <p className={styles.topicDescription}>
                          {topic.description}
                        </p>
                      )}
                      
                      <div className={styles.topicMeta}>
                        {!topic.isPublic && (
                          <span className={styles.topicType}>
                            Riservato
                          </span>
                        )}
                        <span className={styles.createdBy}>
                          Creato da {topic.createdBy?.username || 'Anonimo'}
                        </span>
                        <span className={styles.createdAt}>
                          {topic.createdAt ? new Date(topic.createdAt).toLocaleDateString('it-IT') : 'Data sconosciuta'}
                        </span>
                      </div>
                    </div>
                    
                    <div className={styles.topicStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{topic.postCount}</span>
                        <span className={styles.statLabel}>
                          {topic.postCount === 1 ? 'Post' : 'Posts'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.lastPost}>
                    <span className={styles.lastPostLabel}>Ultimo post</span>
                    <span className={styles.lastPostInfo}>
                      {formatLastPost(topic)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

