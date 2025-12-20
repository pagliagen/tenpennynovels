import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/Search.module.scss';
import { searchForum, ForumPost, PaginatedResponse } from '@/lib/forumApi';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface SearchPageProps {
  authContext: AuthContext;
}

export default function SearchPage({ authContext }: SearchPageProps) {
  const router = useRouter();
  const { q: queryParam, topic: topicParam } = router.query;
  
  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [results, setResults] = useState<ForumPost[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    if (queryParam && typeof queryParam === 'string') {
      setQuery(queryParam);
      setHasSearched(true);
      performSearch(queryParam, topicParam as string || '', 1);
    }
    if (topicParam && typeof topicParam === 'string') {
      setTopicFilter(topicParam);
    }
  }, [queryParam, topicParam]);

  const performSearch = async (searchQuery: string, topicSlug: string = '', page: number = 1) => {
    if (!searchQuery.trim()) return;
    
    // Check authentication for protected content
    if (!authContext.isAuthenticated) {
      setError('Accesso richiesto. Effettua il login per cercare nel forum.');
      setResults([]);
      setPagination({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response: PaginatedResponse<ForumPost> = await searchForum(
        searchQuery.trim(),
        topicSlug || undefined,
        page,
        20
      );
      
      setResults(response.data);
      setPagination(response.pagination);
      
      // Update URL
      const params = new URLSearchParams();
      params.set('q', searchQuery.trim());
      if (topicSlug) params.set('topic', topicSlug);
      if (page > 1) params.set('page', page.toString());
      
      router.replace(`/search?${params.toString()}`, undefined, { shallow: true });
      
    } catch (err) {
      console.error('Search error:', err);
      if (err instanceof Error && err.message.includes('401')) {
        setError('Accesso richiesto. Effettua il login per cercare nel forum.');
      } else if (err instanceof Error && err.message.includes('403')) {
        setError('Non hai i permessi per effettuare ricerche nel forum.');
      } else {
        setError('Errore durante la ricerca. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setHasSearched(true);
    performSearch(query, topicFilter, 1);
  };

  const handlePageChange = (newPage: number) => {
    performSearch(query, topicFilter, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    // First handle [searchmatch] tags from API response
    let highlightedText = text.replace(/\[searchmatch\](.*?)\[\/searchmatch\]/g, '<mark>$1</mark>');
    
    // Then handle any remaining search terms not already tagged
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlightedText = highlightedText.replace(regex, (match) => {
      // Don't highlight if already inside a <mark> tag
      return match.includes('<mark>') ? match : `<mark>${match}</mark>`;
    });
    
    return highlightedText;
  };

  const getPostPreview = (content: string, searchTerm: string) => {
    const maxLength = 200;
    let preview = content;
    
    // Try to find the search term and show context around it
    if (searchTerm) {
      const lowerContent = content.toLowerCase();
      const lowerTerm = searchTerm.toLowerCase();
      const index = lowerContent.indexOf(lowerTerm);
      
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + searchTerm.length + 150);
        preview = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
      }
    }
    
    if (preview.length > maxLength) {
      preview = preview.slice(0, maxLength) + '...';
    }
    
    return preview;
  };

  const formatDate = (date: Date | string) => {
    const now = new Date();
    const postDate = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - postDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Oggi';
    } else if (diffDays === 1) {
      return 'Ieri';
    } else if (diffDays < 30) {
      return `${diffDays} giorni fa`;
    } else {
      return postDate.toLocaleDateString('it-IT');
    }
  };

  return (
    <>
      <Head>
        <title>
          {query ? `Ricerca: "${query}" - TenpennyNovels Forum` : 'Ricerca - TenpennyNovels Forum'}
        </title>
        <meta name="description" content="Cerca nelle discussioni del forum TenpennyNovels" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.searchContainer}>
        {/* Search Form */}
        <div className={styles.searchHeader}>
          <h1 className={styles.title}>Ricerca nel Forum</h1>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchInputs}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca discussioni, post, argomenti..."
                className={styles.searchInput}
                autoFocus
              />
              <input
                type="text"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="Filtra per argomento (opzionale)"
                className={styles.topicInput}
              />
            </div>
            <button 
              type="submit" 
              className={`btn btn-primary ${styles.searchButton}`}
              disabled={loading || !query.trim() || !authContext.isAuthenticated}
            >
              {loading ? 'Ricerca...' : '🔍 Cerca'}
            </button>
          </form>
          
          {!authContext.isAuthenticated && (
            <div className={styles.authWarning}>
              <p>
                🔒 <strong>Accesso richiesto:</strong> Devi essere autenticato per cercare nel forum.
                <br />
                <a href={process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com'}>
                  Accedi al tuo account
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className={styles.resultsContainer}>
            {loading && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Ricerca in corso...</p>
              </div>
            )}

            {error && (
              <div className={styles.errorContainer}>
                <p className={styles.errorMessage}>{error}</p>
                <button onClick={() => performSearch(query, topicFilter, pagination.page)} className="btn btn-secondary">
                  Riprova
                </button>
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Results Summary */}
                <div className={styles.resultsSummary}>
                  <p>
                    {pagination.total === 0 ? (
                      <>Nessun risultato per <strong>"{query}"</strong></>
                    ) : (
                      <>
                        Trovati <strong>{pagination.total}</strong> risultati per{' '}
                        <strong>"{query}"</strong>
                        {topicFilter && (
                          <> nell'argomento <strong>"{topicFilter}"</strong></>
                        )}
                      </>
                    )}
                  </p>
                  {pagination.totalPages > 1 && (
                    <p className={styles.pageInfo}>
                      Pagina {pagination.page} di {pagination.totalPages}
                    </p>
                  )}
                </div>

                {/* No Results */}
                {results.length === 0 && (
                  <div className={styles.noResults}>
                    <h3>Nessun risultato trovato</h3>
                    <p>Suggerimenti per migliorare la ricerca:</p>
                    <ul>
                      <li>Verifica l'ortografia delle parole chiave</li>
                      <li>Prova con termini più generici</li>
                      <li>Rimuovi il filtro per argomento</li>
                      <li>Usa meno parole chiave</li>
                    </ul>
                  </div>
                )}

                {/* Results List */}
                {results.length > 0 && (
                  <div className={styles.resultsList}>
                    {results.map((post) => (
                      <div key={post.id} className={styles.resultCard}>
                        <div className={styles.resultHeader}>
                          {post.discussionSlug ? (
                            <Link 
                              href={`/${post.topicSlug}/${post.discussionSlug}`}
                              className={styles.discussionLink}
                            >
                              Discussione: {post.discussionSlug.replace(/-/g, ' ')}
                            </Link>
                          ) : (
                            <Link 
                              href={`/${post.topicSlug}`}
                              className={styles.discussionLink}
                            >
                              Argomento: {post.topicSlug.replace(/-/g, ' ')}
                            </Link>
                          )}
                          <span className={styles.topicTag}>
                            in {post.topicSlug.replace(/-/g, ' ')}
                          </span>
                        </div>
                        
                        <div 
                          className={styles.postContent}
                          dangerouslySetInnerHTML={{
                            __html: highlightSearchTerm(
                              getPostPreview(post.content, query),
                              query
                            )
                          }}
                        />
                        
                        <div className={styles.resultMeta}>
                          <span className={styles.author}>
                            di <strong>{post.authorCharacterName || post.authorUsername}</strong>
                          </span>
                          <span className={styles.date}>
                            {formatDate(post.createdAt)}
                          </span>
                          {post.isEdited && (
                            <span className={styles.editedBadge}>modificato</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
                      {pagination.page} / {pagination.totalPages}
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
              </>
            )}
          </div>
        )}

        {/* Search Tips */}
        {!hasSearched && (
          <div className={styles.searchTips}>
            <h2>Suggerimenti per la ricerca</h2>
            <div className={styles.tipsGrid}>
              <div className={styles.tipCard}>
                <h3>🔍 Ricerca generale</h3>
                <p>Usa parole chiave semplici e specifiche per trovare discussioni e post rilevanti.</p>
              </div>
              <div className={styles.tipCard}>
                <h3>🎯 Filtro per argomento</h3>
                <p>Limita la ricerca a un argomento specifico per risultati più mirati.</p>
              </div>
              <div className={styles.tipCard}>
                <h3>📝 Contenuto dei post</h3>
                <p>La ricerca viene effettuata nel contenuto dei post, nei titoli e nelle descrizioni.</p>
              </div>
              <div className={styles.tipCard}>
                <h3>🔒 Accesso privato</h3>
                <p>I risultati rispettano i permessi di accesso. Alcune discussioni potrebbero non essere visibili.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}