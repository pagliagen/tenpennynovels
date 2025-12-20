import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/RecentDiscussions.module.scss';
import { Discussion, getRecentDiscussions } from '@/lib/forumApi';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface RecentPageProps {
  authContext: AuthContext;
}

export default function RecentPage({ authContext }: RecentPageProps) {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentDiscussions();
  }, []);

  const loadRecentDiscussions = async () => {
    try {
      setLoading(true);
      setError(null);
      const recentDiscussions = await getRecentDiscussions(20); // Last 20 discussions
      setDiscussions(recentDiscussions.data);
    } catch (err) {
      console.error('Failed to load recent discussions:', err);
      setError('Errore nel caricamento delle discussioni recenti');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscussionClick = (discussion: Discussion) => {
    router.push(`/${discussion.topicSlug}/${discussion.slug}`);
  };

  const formatLastPost = (discussion: Discussion) => {
    if (!discussion.lastPostAt || !discussion.lastPostBy) return 'Nessun post';
    
    const date = new Date(discussion.lastPostAt);
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
    
    const byUser = discussion.lastPostBy?.characterName || discussion.lastPostBy?.username || 'Anonimo';
    
    return `${timeAgo} da ${byUser}`;
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Discussioni Recenti</title>
        <meta name="description" content="Ultime discussioni attive nel forum di TenpennyNovels" />
        <meta name="robots" content="index,follow" />
      </Head>

      <div className={styles.recentContainer}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Discussioni Recenti</h2>
          <p className={styles.subtitle}>
            Le ultime discussioni con attività recente nel forum
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Caricamento discussioni recenti...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button onClick={loadRecentDiscussions} className="btn btn-secondary">
              Riprova
            </button>
          </div>
        )}

        {/* Discussions list */}
        {!loading && !error && (
          <div className={styles.discussionsList}>
            {discussions.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>Nessuna discussione recente</h3>
                <p>Non ci sono discussioni con attività recente.</p>
              </div>
            ) : (
              discussions.map((discussion) => (
                <div
                  key={discussion.id}
                  className={`${styles.discussionCard} ${discussion.isPinned ? styles.pinnedDiscussion : ''} ${discussion.isLocked ? styles.lockedDiscussion : ''}`}
                  onClick={() => handleDiscussionClick(discussion)}
                >
                  <div className={styles.discussionMain}>
                    <div className={styles.discussionInfo}>
                      <h3 className={styles.discussionTitle}>
                        {discussion.isPinned && <span className={styles.pinnedBadge}>📌</span>}
                        {discussion.isLocked && <span className={styles.lockedBadge}>🔒</span>}
                        {discussion.title}
                      </h3>
                      
                      <div className={styles.discussionMeta}>
                        <span className={styles.topic}>
                          in <strong>{discussion.topicSlug}</strong>
                        </span>
                        <span className={styles.author}>
                          da {discussion.createdBy?.characterName || discussion.createdBy?.username || 'Anonimo'}
                        </span>
                        <span className={styles.createdAt}>
                          {discussion.createdAt ? new Date(discussion.createdAt).toLocaleDateString('it-IT') : 'Data sconosciuta'}
                        </span>
                      </div>
                      
                      {discussion.tags && discussion.tags.length > 0 && (
                        <div className={styles.tags}>
                          {discussion.tags.map((tag, index) => (
                            <span key={index} className={styles.tag}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.discussionStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{discussion.postCount}</span>
                        <span className={styles.statLabel}>
                          {discussion.postCount === 1 ? 'Post' : 'Posts'}
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{discussion.viewCount}</span>
                        <span className={styles.statLabel}>Views</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.lastPost}>
                    <span className={styles.lastPostLabel}>Ultimo post</span>
                    <span className={styles.lastPostInfo}>
                      {formatLastPost(discussion)}
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

