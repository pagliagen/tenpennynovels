import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/DiscussionList.module.scss';
import { 
  ForumTopic, 
  Discussion, 
  getTopic, 
  getDiscussions, 
  createDiscussion,
  PaginatedResponse,
  checkTopicFavorite,
  addTopicToFavorites,
  removeTopicFromFavorites
} from '@/lib/forumApi';
import { 
  AuthContext, 
  canManageForums, 
  canAccessPrivateForums,
  parseAuthTokens,
  buildAuthContext 
} from '@/lib/auth';

interface TopicPageProps {
  topic: ForumTopic | null;
  authContext: AuthContext;
  error?: string;
}

export default function TopicPage({ topic, authContext, error }: TopicPageProps) {
  const router = useRouter();
  const { topicSlug } = router.query;
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [discussionsError, setDiscussionsError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Redirect if topic not found or access denied
  useEffect(() => {
    if (error) {
      if (error.includes('404')) {
        router.push('/404');
      } else if (error.includes('access')) {
        router.push('/access-denied');
      }
      return;
    }

    if (topic && !topic.isPublic) {
      if (!canAccessPrivateForums(authContext.user, authContext.character)) {
        router.push('/access-denied?reason=private-topic');
        return;
      }
    }
  }, [error, topic, authContext, router]);

  // Load discussions when topic changes
  useEffect(() => {
    if (topic && topicSlug && typeof topicSlug === 'string') {
      loadDiscussions(topicSlug, 1);
      checkFavoriteStatus(topicSlug);
    }
  }, [topic, topicSlug]);

  const checkFavoriteStatus = async (slug: string) => {
    if (!authContext.isAuthenticated) return;
    
    try {
      const result = await checkTopicFavorite(slug);
      setIsFavorite(result.isFavorite);
    } catch (err) {
      console.error('Failed to check favorite status:', err);
    }
  };

  const loadDiscussions = async (slug: string, page: number = 1) => {
    try {
      setLoading(true);
      setDiscussionsError(null);
      const response: PaginatedResponse<Discussion> = await getDiscussions(slug, page, 20);
      setDiscussions(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to load discussions:', err);
      setDiscussionsError('Errore nel caricamento delle discussioni');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscussionClick = (discussion: Discussion) => {
    router.push(`/${topic?.slug}/${discussion.slug}`);
  };

  const handleCreateDiscussion = () => {
    if (!authContext.isAuthenticated) {
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
      return;
    }
    
    if (!topic?.isPublic && !authContext.character?.isApproved) {
      router.push('/access-denied?reason=character-required');
      return;
    }
    
    setShowCreateForm(true);
  };

  const handlePageChange = (newPage: number) => {
    if (topicSlug && typeof topicSlug === 'string') {
      loadDiscussions(topicSlug, newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleFavorite = async () => {
    if (!authContext.isAuthenticated || !topic) {
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
      return;
    }

    try {
      setFavoriteLoading(true);
      if (isFavorite) {
        await removeTopicFromFavorites(topic.slug);
        setIsFavorite(false);
      } else {
        await addTopicToFavorites(topic.slug);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Could add a toast notification here
    } finally {
      setFavoriteLoading(false);
    }
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
    
    const byUser = discussion.lastPostBy.characterName || discussion.lastPostBy.username;
    
    return `${timeAgo} da ${byUser}`;
  };

  if (error || !topic) {
    return null; // Component will redirect via useEffect
  }

  const canCreateDiscussion = authContext.isAuthenticated && 
    (topic.isPublic || (authContext.character?.isApproved && canAccessPrivateForums(authContext.user, authContext.character)));

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - {topic.title}</title>
        <meta name="description" content={topic.description || `Discussioni nell'argomento ${topic.title}`} />
        {topic.isPublic ? (
          <meta name="robots" content="index,follow" />
        ) : (
          <meta name="robots" content="noindex,nofollow" />
        )}
      </Head>

      <div className={styles.discussionListContainer}>
        {/* Topic Header */}
        <div className={styles.topicHeader}>
          <div className={styles.topicInfo}>
            <div className={styles.topicIcon}>
              {topic.icon || (topic.isPublic ? '🌍' : '🔒')}
            </div>
            <div className={styles.topicDetails}>
              <h1 className={styles.topicTitle}>
                {topic.isPinned && <span className={styles.pinnedBadge}>📌</span>}
                {topic.isLocked && <span className={styles.lockedBadge}>🔒</span>}
                {topic.title}
              </h1>
              {topic.description && (
                <p className={styles.topicDescription}>{topic.description}</p>
              )}
              <div className={styles.topicMeta}>
                {!topic.isPublic && (
                  <span className={styles.visibility}>
                    🔒 Privato
                  </span>
                )}
                <span className={styles.postCount}>
                  {topic.postCount} discussioni totali
                </span>
              </div>
            </div>
          </div>
          
          <div className={styles.topicActions}>
            {authContext.isAuthenticated && (
              <button 
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                className={`btn ${isFavorite ? 'btn-warning' : 'btn-secondary'} ${styles.favoriteButton}`}
                title={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                {favoriteLoading ? (
                  '⏳'
                ) : (
                  <>
                    {isFavorite ? '⭐' : '☆'} {isFavorite ? 'Preferito' : 'Aggiungi ai Preferiti'}
                  </>
                )}
              </button>
            )}
            
            {canCreateDiscussion && !topic.isLocked && (
              <button 
                onClick={handleCreateDiscussion}
                className={`btn btn-primary ${styles.newDiscussionButton}`}
              >
                ➕ Nuova Discussione
              </button>
            )}
            
            {canManageForums(authContext.user) && (
              <Link 
                href={`/admin/topics/${topic.slug}`}
                className={`btn btn-secondary ${styles.manageButton}`}
              >
                ⚙️ Gestisci
              </Link>
            )}
          </div>
        </div>

        {/* Discussions List */}
        <div className={styles.discussionsList}>
          {/* Loading state */}
          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>Caricamento discussioni...</p>
            </div>
          )}

          {/* Error state */}
          {discussionsError && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{discussionsError}</p>
              <button 
                onClick={() => topicSlug && typeof topicSlug === 'string' && loadDiscussions(topicSlug, pagination.page)} 
                className="btn btn-secondary"
              >
                Riprova
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !discussionsError && discussions.length === 0 && (
            <div className={styles.emptyState}>
              <h3>Nessuna discussione</h3>
              <p>Non ci sono ancora discussioni in questo argomento.</p>
              {canCreateDiscussion && !topic.isLocked && (
                <button onClick={handleCreateDiscussion} className="btn btn-primary">
                  Inizia la prima discussione
                </button>
              )}
            </div>
          )}

          {/* Discussions */}
          {!loading && !discussionsError && discussions.length > 0 && (
            <>
              {discussions.map((discussion) => (
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
                        <span className={styles.author}>
                          Creata da{' '}
                          <strong>
                            {discussion.createdBy.characterName || discussion.createdBy.username}
                          </strong>
                        </span>
                        <span className={styles.createdAt}>
                          {new Date(discussion.createdAt).toLocaleDateString('it-IT')}
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
                        <span className={styles.statLabel}>Visualizzazioni</span>
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
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
              className={`btn btn-secondary ${styles.paginationButton}`}
            >
              ‹ Precedente
            </button>
            
            <div className={styles.paginationInfo}>
              Pagina {pagination.page} di {pagination.totalPages}
            </div>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className={`btn btn-secondary ${styles.paginationButton}`}
            >
              Successiva ›
            </button>
          </div>
        )}
      </div>

      {/* Create Discussion Modal - TODO: Implement */}
      {showCreateForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Nuova Discussione</h3>
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

