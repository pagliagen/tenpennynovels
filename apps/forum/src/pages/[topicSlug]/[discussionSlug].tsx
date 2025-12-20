import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/Discussion.module.scss';
import { 
  ForumTopic, 
  Discussion, 
  ForumPost,
  getTopic, 
  getDiscussion,
  getPosts,
  createPost,
  PaginatedResponse,
  checkTopicFavorite,
  addTopicToFavorites,
  removeTopicFromFavorites
} from '@/lib/forumApi';
import { 
  AuthContext, 
  canManageForums,
  canModerateContent,
  canDeletePosts,
  canAccessPrivateForums,
  parseAuthTokens,
  buildAuthContext 
} from '@/lib/auth';

interface DiscussionPageProps {
  authContext: AuthContext;
}

export default function DiscussionPage({ authContext }: DiscussionPageProps) {
  const router = useRouter();
  const { topicSlug, discussionSlug } = router.query;
  
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyToPost, setReplyToPost] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Load topic, discussion and posts
  useEffect(() => {
    if (topicSlug && discussionSlug && typeof topicSlug === 'string' && typeof discussionSlug === 'string') {
      loadDiscussionData(topicSlug, discussionSlug);
      loadFavoriteStatus(topicSlug);
    }
  }, [topicSlug, discussionSlug, authContext.isAuthenticated]);

  const loadDiscussionData = async (tSlug: string, dSlug: string, page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      // Load topic and discussion info
      const [topicData, discussionData, postsData] = await Promise.all([
        getTopic(tSlug),
        getDiscussion(tSlug, dSlug),
        getPosts(tSlug, dSlug, page, 20)
      ]);
      
      setTopic(topicData);
      setDiscussion(discussionData);
      setPosts(postsData.data);
      setPagination(postsData.pagination);
      
    } catch (err) {
      console.error('Failed to load discussion:', err);
      setError('Errore nel caricamento della discussione');
    } finally {
      setLoading(false);
    }
  };

  const loadFavoriteStatus = async (tSlug: string) => {
    if (!authContext.isAuthenticated) {
      setIsFavorite(false);
      return;
    }
    
    try {
      const favoriteStatus = await checkTopicFavorite(tSlug);
      setIsFavorite(favoriteStatus.isFavorite);
    } catch (err) {
      console.error('Failed to load favorite status:', err);
      setIsFavorite(false);
    }
  };

  const toggleFavorite = async () => {
    if (!authContext.isAuthenticated || !topicSlug || typeof topicSlug !== 'string') {
      return;
    }

    try {
      setFavoriteLoading(true);
      
      if (isFavorite) {
        await removeTopicFromFavorites(topicSlug);
        setIsFavorite(false);
      } else {
        await addTopicToFavorites(topicSlug);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      alert('Errore nel gestire i preferiti. Riprova.');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleReply = (postId?: string) => {
    if (!authContext.isAuthenticated) {
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
      return;
    }
    
    if (topic && !topic.isPublic && !authContext.character?.isApproved) {
      router.push('/access-denied?reason=character-required');
      return;
    }
    
    if (discussion?.isLocked && !canManageForums(authContext.user)) {
      return; // Can't reply to locked discussions unless you're a manager
    }
    
    setReplyToPost(postId || null);
    setShowReplyForm(true);
    setReplyContent('');
  };

  const handleSubmitReply = async () => {
    if (!topicSlug || !discussionSlug || !replyContent.trim()) return;
    
    try {
      setSubmitting(true);
      await createPost(topicSlug as string, discussionSlug as string, {
        content: replyContent.trim(),
        replyToPostId: replyToPost || undefined,
      });
      
      // Reload posts
      await loadDiscussionData(topicSlug as string, discussionSlug as string, pagination.page);
      
      // Reset form
      setShowReplyForm(false);
      setReplyContent('');
      setReplyToPost(null);
      
    } catch (err) {
      console.error('Failed to create post:', err);
      alert('Errore nella creazione del post. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (topicSlug && discussionSlug && typeof topicSlug === 'string' && typeof discussionSlug === 'string') {
      loadDiscussionData(topicSlug, discussionSlug, newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatPostDate = (date: Date | string) => {
    const now = new Date();
    const postDate = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - postDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 7) {
      return postDate.toLocaleDateString('it-IT');
    } else if (diffDays > 0) {
      return `${diffDays} giorni fa`;
    } else if (diffHours > 0) {
      return `${diffHours} ore fa`;
    } else {
      return 'Meno di un\'ora fa';
    }
  };

  const canParticipate = authContext.isAuthenticated && 
    (topic?.isPublic || (authContext.character?.isApproved && canAccessPrivateForums(authContext.user, authContext.character)));

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Caricamento discussione...</p>
      </div>
    );
  }

  if (error || !topic || !discussion) {
    return (
      <div className={styles.errorContainer}>
        <h2>Discussione non trovata</h2>
        <p>{error || 'La discussione richiesta non esiste o non hai i permessi per visualizzarla.'}</p>
        <Link href="/" className="btn btn-primary">
          Torna al Forum
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - {discussion.title} | {topic.title}</title>
        <meta name="description" content={`Discussione "${discussion.title}" nell'argomento ${topic.title}`} />
        {topic.isPublic ? (
          <meta name="robots" content="index,follow" />
        ) : (
          <meta name="robots" content="noindex,nofollow" />
        )}
      </Head>

      <div className={styles.discussionContainer}>
        {/* Breadcrumb Override */}
        <nav className={styles.breadcrumbOverride}>
          <Link href="/" className={styles.breadcrumbLink}>🏠 Home</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <Link href={`/${topic.slug}`} className={styles.breadcrumbLink}>
            {topic.title}
          </Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span className={styles.breadcrumbCurrent}>{discussion.title}</span>
        </nav>

        {/* Discussion Header */}
        <div className={styles.discussionHeader}>
          <div className={styles.discussionInfo}>
            <h1 className={styles.discussionTitle}>
              {discussion.isPinned && <span className={styles.pinnedBadge}>📌</span>}
              {discussion.isLocked && <span className={styles.lockedBadge}>🔒</span>}
              {discussion.title}
            </h1>
            
            <div className={styles.discussionMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Creata da:</span>
                <span className={styles.metaValue}>
                  {discussion.createdBy?.characterName || discussion.createdBy?.username || 'Anonimo'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Data:</span>
                <span className={styles.metaValue}>
                  {discussion.createdAt ? new Date(discussion.createdAt).toLocaleDateString('it-IT') : 'Data sconosciuta'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Post:</span>
                <span className={styles.metaValue}>{discussion.postCount}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Visualizzazioni:</span>
                <span className={styles.metaValue}>{discussion.viewCount}</span>
              </div>
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
          
          <div className={styles.discussionActions}>
            {authContext.isAuthenticated && (
              <button 
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                className={`btn ${isFavorite ? 'btn-warning' : 'btn-secondary'} ${styles.favoriteButton}`}
                title={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                {favoriteLoading ? '⏳' : (isFavorite ? '⭐' : '☆')} 
                {favoriteLoading ? 'Attendere...' : (isFavorite ? 'Preferito' : 'Preferiti')}
              </button>
            )}
            
            {canParticipate && !discussion.isLocked && (
              <button 
                onClick={() => handleReply()}
                className={`btn btn-primary ${styles.replyButton}`}
              >
                💬 Rispondi
              </button>
            )}
            
            {canManageForums(authContext.user) && (
              <Link 
                href={`/admin/discussions/${topic.slug}/${discussion.slug}`}
                className={`btn btn-secondary ${styles.manageButton}`}
              >
                ⚙️ Gestisci
              </Link>
            )}
          </div>
        </div>

        {/* Posts List */}
        <div className={styles.postsList}>
          {posts.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>Nessun post</h3>
              <p>Non ci sono ancora post in questa discussione.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <div key={post.id} className={styles.postCard}>
                <div className={styles.postHeader}>
                  <div className={styles.authorInfo}>
                    <div className={styles.authorAvatar}>
                      {(post.authorCharacterName || post.authorUsername).charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.authorDetails}>
                      <span className={styles.authorName}>
                        {post.authorCharacterName || post.authorUsername}
                      </span>
                      {post.authorCharacterName && (
                        <span className={styles.authorUsername}>
                          ({post.authorUsername})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.postMeta}>
                    <span className={styles.postNumber}>#{index + 1 + (pagination.page - 1) * pagination.limit}</span>
                    <span className={styles.postDate}>
                      {formatPostDate(post.createdAt)}
                    </span>
                    {post.isEdited && (
                      <span className={styles.editedBadge} title="Post modificato">
                        ✏️
                      </span>
                    )}
                  </div>
                </div>
                
                <div className={styles.postContent}>
                  {post.replyToPostId && (
                    <div className={styles.replyReference}>
                      <span>In risposta a un post precedente</span>
                    </div>
                  )}
                  
                  <div 
                    className={styles.postBody}
                    dangerouslySetInnerHTML={{ 
                      __html: post.content.replace(/\n/g, '<br/>') 
                    }}
                  />
                </div>
                
                <div className={styles.postActions}>
                  {canParticipate && !discussion.isLocked && (
                    <button 
                      onClick={() => handleReply(post.id)}
                      className={styles.replyActionButton}
                    >
                      ↩️ Rispondi
                    </button>
                  )}
                  
                  {(post.authorUserId === authContext.user?.userId || canModerateContent(authContext.user)) && (
                    <button 
                      className={styles.editActionButton}
                      title="Modifica post"
                    >
                      ✏️ Modifica
                    </button>
                  )}
                  
                  {(post.authorUserId === authContext.user?.userId || canDeletePosts(authContext.user)) && (
                    <button 
                      className={styles.deleteActionButton}
                      title="Elimina post"
                    >
                      🗑️ Elimina
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
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

        {/* Quick Reply Button */}
        {canParticipate && !discussion.isLocked && !showReplyForm && (
          <div className={styles.quickReplyContainer}>
            <button 
              onClick={() => handleReply()}
              className={`btn btn-primary ${styles.quickReplyButton}`}
            >
              💬 Rispondi Veloce
            </button>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {showReplyForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>
                {replyToPost ? 'Rispondi al Post' : 'Nuovo Post'}
              </h3>
              <button 
                onClick={() => setShowReplyForm(false)}
                className={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Scrivi il tuo messaggio..."
                className={styles.replyTextarea}
                rows={8}
                disabled={submitting}
              />
              
              <div className={styles.modalFooter}>
                <button 
                  onClick={() => setShowReplyForm(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annulla
                </button>
                <button 
                  onClick={handleSubmitReply}
                  className="btn btn-primary"
                  disabled={submitting || !replyContent.trim()}
                >
                  {submitting ? 'Invio...' : 'Invia Risposta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

