import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { searchDocuments, SearchResult } from '@/lib/documentApi';
import { AuthContext } from '@/lib/auth';
import styles from '@/styles/pages/DocumentView.module.scss';

export default function SearchPage() {
  const router = useRouter();
  const { q: query } = router.query;
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authContext, setAuthContext] = useState<AuthContext>({ isAuthenticated: false, tokens: {} });
  const [currentQuery, setCurrentQuery] = useState('');

  // Initialize auth context
  useEffect(() => {
    async function loadAuthData() {
      try {
        const authTestResponse = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/documents/list`, {
          credentials: 'include'
        });
        
        if (authTestResponse.ok) {
          setAuthContext({ isAuthenticated: true, tokens: {} });
        } else {
          setAuthContext({ isAuthenticated: false, tokens: {} });
        }
      } catch (error) {
        setAuthContext({ isAuthenticated: false, tokens: {} });
      }
    }
    loadAuthData();
  }, []);

  // Perform search when query changes
  useEffect(() => {
    if (query && typeof query === 'string') {
      setCurrentQuery(query);
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      const results = await searchDocuments(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setError('Errore durante la ricerca. Riprova più tardi.');
      // Fallback to empty results on error
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const highlightSearchTerm = (text: string, searchTerm: string): string => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const getDocumentTypeLabel = (type: string): string => {
    switch (type) {
      case 'ambientazione':
        return 'AMBIENTAZIONE';
      case 'regolamento':
        return 'REGOLAMENTO';
      default:
        return type.toUpperCase();
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Data sconosciuta';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Data non valida';
    return dateObj.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <DocumentsLayout 
      authContext={authContext}
      title={`Ricerca: "${currentQuery}" - TenpennyNovels`}
      description="Risultati di ricerca nei documenti di TenpennyNovels"
    >
      <Head>
        <title>{currentQuery ? `Ricerca: "${currentQuery}"` : 'Ricerca'} - TenpennyNovels</title>
        <meta 
          name="description" 
          content={currentQuery ? `Risultati di ricerca per "${currentQuery}"` : 'Ricerca nei documenti'}
        />
      </Head>

      {/* Search Results Content */}
      <div className={styles.documentContainer}>
        <header className={styles.documentHeader}>
          <nav className={styles.breadcrumb}>
            <Link href="/">Documenti</Link>
            <span className={styles.separator}>›</span>
            <span className={styles.currentPage}>
              Ricerca{currentQuery && `: "${currentQuery}"`}
            </span>
          </nav> 
        </header>
        <div className={styles.layout}>
          <h1>🔍 Risultati di Ricerca</h1>
          
          {currentQuery && (
            <div className={styles.paper}>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ color: '#8B4513', marginBottom: '1rem' }}>
                  Ricerca per: "{currentQuery}"
                </h2>
                
                {loading && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>🔍 Ricerca in corso...</p>
                  </div>
                )}

                {error && (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(220, 20, 60, 0.1)', borderRadius: '8px', margin: '1rem 0' }}>
                    <p style={{ color: '#DC143C', fontWeight: 'bold' }}>⚠️ {error}</p>
                  </div>
                )}

                {!loading && !error && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h3>📭 Nessun risultato trovato</h3>
                    <p>La ricerca per "{currentQuery}" non ha prodotto risultati.</p>
                    <p>Prova con termini diversi o più generali.</p>
                  </div>
                )}

                {!loading && searchResults.length > 0 && (
                  <div>
                    <p style={{ color: '#8B4513', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                      📊 Trovati {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'}:
                    </p>
                    
                    {searchResults.map((result, index) => (
                      <div key={result.id} style={{ 
                        marginBottom: '2rem', 
                        paddingBottom: '1.5rem', 
                        borderBottom: '1px solid #CD853F' 
                      }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <span style={{ 
                            background: '#8B4513', 
                            color: 'white', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '3px', 
                            fontSize: '0.8rem',
                            marginRight: '0.5rem'
                          }}>
                            {getDocumentTypeLabel(result.type)}
                          </span>
                          <span style={{ color: '#666', fontSize: '0.9rem' }}>
                            Score: {(result.score * 100).toFixed(0)}% • {result.matchingSections} sezioni
                          </span>
                        </div>
                        
                        <h3 style={{ color: '#8B4513', margin: '0.5rem 0' }}>
                          <Link 
                            href={`/${result.type}/${result.slug}`}
                            style={{ color: '#8B4513', textDecoration: 'none' }}
                          >
                            {result.title}
                          </Link>
                        </h3>
                        
                        <p style={{ marginBottom: '1rem', lineHeight: '1.6', color: '#2c1810' }}>
                          <span dangerouslySetInnerHTML={{ 
                            __html: highlightSearchTerm(result.excerpt, currentQuery) 
                          }} />
                        </p>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: '0.9rem', color: '#666', margin: '0' }}>
                            Ultima modifica: {formatDate(result.lastUpdated)}
                          </p>
                          <Link 
                            href={`/${result.type}/${result.slug}`} 
                            style={{ color: '#8B4513', textDecoration: 'underline', fontSize: '0.9rem' }}
                          >
                            leggi documento →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!currentQuery && (
            <div className={styles.paper}>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h2>🔍 Ricerca nei Documenti</h2>
                <p>Utilizza la barra di ricerca nell'header per cercare nei documenti di TenpennyNovels.</p>
                <p>Puoi cercare in tutti i documenti di ambientazione e regolamento.</p>
                <div style={{ marginTop: '2rem' }}>
                  <Link 
                    href="/ambientazione" 
                    style={{ color: '#8B4513', textDecoration: 'underline', marginRight: '2rem' }}
                  >
                    Sfoglia Ambientazione
                  </Link>
                  <Link 
                    href="/regolamento" 
                    style={{ color: '#8B4513', textDecoration: 'underline' }}
                  >
                    Sfoglia Regolamento
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DocumentsLayout>
  );
}