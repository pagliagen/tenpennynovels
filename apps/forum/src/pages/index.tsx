import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/TopicList.module.scss';
import { ForumTopic, getTopics, createTopic } from '@/lib/forumApi';
import { AuthContext, canManageForums } from '@/lib/auth';

interface HomePageProps {
  authContext: AuthContext;
}

export default function HomePage({ authContext }: HomePageProps) {
  const router = useRouter();
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load topics on component mount
  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      const topicsData = await getTopics();
      setTopics(topicsData);
    } catch (err) {
      console.error('Failed to load topics:', err);
      setError('Errore nel caricamento degli argomenti');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = () => {
    setShowCreateForm(true);
  };

  const handleTopicClick = (topic: ForumTopic) => {
    router.push(`/${topic.slug}`);
  };

  // Filter topics based on authentication status
  const visibleTopics = topics.filter(topic => {
    // Always show public topics (visible to everyone)
    if (topic.isPublic && topic.isVisible) return true;
    
    // Show private topics only to authenticated users with approved characters
    if (!topic.isPublic && topic.isVisible) {
      return authContext.isAuthenticated && authContext.character?.isApproved;
    }
    
    return false;
  });

  const formatPostCount = (count: number) => {
    if (count === 0) return <><span className={styles.discussionCount}>Nessuna</span> <span>discussione</span></>;  
    if (count === 1) return <><span className={styles.discussionCount}>1</span> <span>discussione</span></>;
    return <><span className={styles.discussionCount}>{count}</span> <span>discussioni</span></>;
  };

  const formatLastPost = (topic: ForumTopic) => {
    if (!topic.lastPostAt || !topic.lastPostBy) return 'Nessun post';
    
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
    
    const byUser = topic.lastPostBy.characterName || topic.lastPostBy.username;
    
    return `${timeAgo} da ${byUser}`;
  };

  // Group topics by category
  const groupTopicsByCategory = (topics: ForumTopic[]) => {
    const grouped: { [category: string]: ForumTopic[] } = {};
    
    topics.forEach(topic => {
      const category = topic.category || 'Senza Categoria';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(topic);
    });
    
    // Sort topics within each category: pinned first, then by last post date
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        const aTime = a.lastPostAt ? new Date(a.lastPostAt).getTime() : 0;
        const bTime = b.lastPostAt ? new Date(b.lastPostAt).getTime() : 0;
        return bTime - aTime;
      });
    });
    
    return grouped;
  };
  
  const topicsByCategory = groupTopicsByCategory(visibleTopics);
  const categoryOrder = ['Generale', 'Gioco di Ruolo', 'Ambientazione', 'Soprannaturale'];

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Comunità GDR Londra Vittoriana</title>
        <meta name="description" content="Benvenuto nel forum di TenpennyNovels, la community del GDR ambientato nella Londra Vittoriana. Discuti gameplay, roleplay e connettiti con altri giocatori." />
      </Head>

      <div className={styles.topicListContainer}>
        {/* Header with actions */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Argomenti del Forum</h2>
            <p className={styles.subtitle}>
              Benvenuto nella community di TenpennyNovels. Esplora gli argomenti e partecipa alle discussioni.
            </p>
          </div>
          
          <div className={styles.headerActions}>
            {canManageForums(authContext.user) && (
              <button 
                onClick={handleCreateTopic}
                className={`btn btn-primary ${styles.createButton}`}
              >
                ➕ Nuovo Argomento
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Caricamento argomenti...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button onClick={loadTopics} className="btn btn-secondary">
              Riprova
            </button>
          </div>
        )}

        {/* Topics list grouped by category */}
        {!loading && !error && (
          <div className={styles.topicsContainer}>
            {visibleTopics.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>Nessun argomento disponibile</h3>
                <p>Non ci sono ancora argomenti nel forum.</p>
                {canManageForums(authContext.user) && (
                  <button onClick={handleCreateTopic} className="btn btn-primary">
                    Crea il primo argomento
                  </button>
                )}
              </div>
            ) : (
              categoryOrder.map(categoryName => {
                const categoryTopics = topicsByCategory[categoryName];
                if (!categoryTopics || categoryTopics.length === 0) return null;
                
                return (
                  <div key={categoryName} className={styles.categorySection}>
                    <h3 className={styles.categoryTitle}>{categoryName}</h3>
                    <div className={styles.topicsGrid}>
                      {categoryTopics.map((topic) => (
                        <div
                          key={topic.id}
                          className={`${styles.topicCard} ${topic.isPinned ? styles.pinnedTopic : ''} ${topic.isLocked ? styles.lockedTopic : ''}`}
                          onClick={() => handleTopicClick(topic)}
                        >
                          <div className={styles.topicHeader}>
                            <div className={styles.topicIcon}>
                              {topic.icon || (topic.isPublic ? '🌍' : '🔒')}
                            </div>
                            <div className={styles.topicInfo}>
                              <h3 className={styles.topicTitle}>
                                {topic.isPinned && <span className={styles.pinnedBadge}>📌</span>}
                                {topic.isLocked && <span className={styles.lockedBadge}>🔒</span>}
                                {topic.title}
                              </h3>
                              {topic.description && (
                                <p className={styles.topicDescription}>{topic.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className={styles.compactStats}>
                            <span className={styles.statText}>{formatPostCount(topic.postCount)}</span>
                            <span className={styles.lastPostText}>
                              {formatLastPost(topic)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* Create Topic Modal - TODO: Implement */}
      {showCreateForm && canManageForums(authContext.user) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Nuovo Argomento</h3>
            <p>Funzionalità in arrivo...</p>
            <button 
              onClick={() => setShowCreateForm(false)}
              className="btn btn-secondary"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </>
  );
}