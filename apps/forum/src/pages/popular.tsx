import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/PopularDiscussions.module.scss';
import { Discussion, getPopularDiscussions } from '@/lib/forumApi';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface PopularPageProps {
  authContext: AuthContext;
}

export default function PopularPage({ authContext }: PopularPageProps) {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadPopularDiscussions();
  }, [timeframe]);

  const loadPopularDiscussions = async () => {
    try {
      setLoading(true);
      setError(null);
      const popularDiscussions = await getPopularDiscussions(20, timeframe);
      setDiscussions(popularDiscussions.data);
    } catch (err) {
      console.error('Failed to load popular discussions:', err);
      setError('Errore nel caricamento delle discussioni popolari');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscussionClick = (discussion: Discussion) => {
    router.push(`/${discussion.topicSlug}/${discussion.slug}`);
  };

  const formatStats = (discussion: Discussion) => {
    const score = (discussion.viewCount || 0) + ((discussion.postCount || 0) * 3);
    return {
      score,
      posts: discussion.postCount || 0,
      views: discussion.viewCount || 0
    };
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Discussioni Popolaris</title>
        <meta name="description" content="Le discussioni più popolari del forum di TenpennyNovels" />
        <meta name="robots" content="index,follow" />
      </Head>

      <div className={styles.popularContainer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Discussioni Popolari</h2>
            <p className={styles.subtitle}>
              Le discussioni più visualizzate e commentate del forum
            </p>
          </div>
          
          <div className={styles.headerRight}>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value as 'week' | 'month' | 'all')}
              className={styles.timeframeSelect}
            >
              <option value="week">Ultima settimana</option>
              <option value="month">Ultimo mese</option>
              <option value="all">Di sempre</option>
            </select>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Caricamento discussioni popolari...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button onClick={loadPopularDiscussions} className="btn btn-secondary">
              Riprova
            </button>
          </div>
        )}

        {/* Discussions list */}
        {!loading && !error && (
          <div className={styles.discussionsList}>
            {discussions.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>Nessuna discussione popolare</h3>
                <p>Non ci sono discussioni popolari per il periodo selezionato.</p>
              </div>
            ) : (
              discussions.map((discussion, index) => {
                const stats = formatStats(discussion);
                return (
                  <div
                    key={discussion.id}
                    className={`${styles.discussionCard} ${discussion.isPinned ? styles.pinnedDiscussion : ''} ${discussion.isLocked ? styles.lockedDiscussion : ''}`}
                    onClick={() => handleDiscussionClick(discussion)}
                  >
                    <div className={styles.rank}>
                      <span className={styles.rankNumber}>#{index + 1}</span>
                    </div>
                    
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
                            {discussion.tags.map((tag, tagIndex) => (
                              <span key={tagIndex} className={styles.tag}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.discussionStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{stats.score}</span>
                          <span className={styles.statLabel}>Score</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{stats.posts}</span>
                          <span className={styles.statLabel}>Posts</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{stats.views}</span>
                          <span className={styles.statLabel}>Views</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.popularityIndicator}>
                      <div className={styles.popularityBar}>
                        <div 
                          className={styles.popularityFill} 
                          style={{ width: `${Math.min(100, (stats.score / Math.max(stats.score, 100)) * 100)}%` }}
                        />
                      </div>
                      <span className={styles.popularityScore}>🔥</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

