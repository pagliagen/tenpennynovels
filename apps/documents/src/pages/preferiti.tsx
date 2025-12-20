import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { AuthContext } from '@/lib/auth';
import { getFavoriteDocuments, removeDocumentFromFavorites, FavoriteDocument } from '@/lib/documentApi';
import styles from '@/styles/pages/DocumentView.module.scss';

export default function PreferitivePage() {
  const [authContext, setAuthContext] = useState<AuthContext>({ isAuthenticated: false, tokens: {} });
  const [favorites, setFavorites] = useState<FavoriteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication and load favorites
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch favorites - this will tell us if user is authenticated
        const favoritesData = await getFavoriteDocuments();
        
        // If we get here, user is authenticated
        setAuthContext({ isAuthenticated: true, tokens: {} });
        setFavorites(favoritesData);
      } catch (err) {
        console.error('Error loading favorites:', err);
        
        if (err instanceof Error && err.message.includes('401')) {
          // Not authenticated
          setAuthContext({ isAuthenticated: false, tokens: {} });
          setError('Accesso richiesto per visualizzare i preferiti');
        } else if (err instanceof Error && err.message.includes('403')) {
          // Authenticated but no permissions
          setAuthContext({ isAuthenticated: true, tokens: {} });
          setError('Non hai i permessi per visualizzare i preferiti');
        } else {
          // Other error
          setError('Errore nel caricamento dei preferiti');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);


  const getDocumentTypeLabel = (category: string): string => {
    switch (category) {
      case 'ambientazione':
        return 'AMBIENTAZIONE';
      case 'regolamento':
        return 'REGOLAMENTO';
      default:
        return category.toUpperCase();
    }
  };

  const removeFavorite = async (slug: string, type: 'ambientazione' | 'regolamento') => {
    try {
      await removeDocumentFromFavorites(type, slug);
      setFavorites(prev => prev.filter(fav => fav.slug !== slug));
    } catch (err) {
      console.error('Error removing favorite:', err);
      setError('Errore nella rimozione del preferito');
    }
  };

  const groupedFavorites = favorites.reduce((acc, fav) => {
    const key = `${fav.type}-${fav.group}`;
    if (!acc[key]) {
      acc[key] = {
        category: fav.type,
        group: fav.group,
        documents: []
      };
    }
    acc[key].documents.push(fav);
    return acc;
  }, {} as Record<string, { category: string; group: string; documents: FavoriteDocument[] }>);

  return (
    <DocumentsLayout
      authContext={authContext}
      title="Documenti Preferiti - TenpennyNovels"
      description="I tuoi documenti preferiti di TenpennyNovels"
    >
      <Head>
        <title>Documenti Preferiti - TenpennyNovels</title>
        <meta
          name="description"
          content="Lista dei documenti preferiti salvati per consultazione rapida"
        />
      </Head>
 
      {/* Preferiti Page Content */}
      <div className={styles.documentContainer}>
        <header className={styles.documentHeader}>
          <nav className={styles.breadcrumb}>
            <a href="/">Documenti</a>
            <span className={styles.separator}>›</span>
            <a href="/preferiti/">Preferiti</a>
            <span className={styles.separator}>›</span>
            <span className={styles.currentPage}>
              Consulta i tuoi documenti preferiti
            </span>
          </nav> 
        </header>
        <div className={styles.layout}>
          {/* Error State */}
          {error && (
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(220, 20, 60, 0.1)', borderRadius: '8px', margin: '2rem 0' }}>
              <p style={{ color: '#DC143C', fontWeight: 'bold' }}>⚠️ {error}</p>
            </div>
          )}

          {/* Not authenticated */}
          {!authContext.isAuthenticated && !loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <h2>🔐 Accesso richiesto</h2>
              <p>
                Devi essere autenticato per vedere i tuoi documenti preferiti.
                <br />
                <a href={process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com'}
                  style={{ color: '#8B4513', textDecoration: 'underline' }}>
                  Accedi al tuo account
                </a>
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>⏳ Caricamento preferiti...</p>
            </div>
          )}


      {/* Favorites List */}
      {!loading && authContext.isAuthenticated && !error && (
        <>
          {favorites.length > 0 ? (
            <div>
              {Object.values(groupedFavorites).map((group, groupIndex) => (
                <div key={`${group.category}-${group.group}-${groupIndex}`} style={{marginBottom: '2rem'}}>
                  <h2 style={{color: '#8B4513', borderBottom: '2px solid #8B4513', paddingBottom: '0.5rem'}}>
                    {getDocumentTypeLabel(group.category)} - {group.group}
                  </h2>
                  
                  {group.documents.map((doc) => (
                    <div key={doc.id} style={{marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #CD853F'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem'}}>
                        <h3 style={{color: '#8B4513', margin: '0'}}>
                          <Link 
                            href={`/${doc.type}/${doc.slug}`}
                            style={{color: '#8B4513', textDecoration: 'none'}}
                          >
                            {doc.title}
                          </Link>
                        </h3>
                        <button
                          onClick={() => removeFavorite(doc.slug, doc.type as "ambientazione" | "regolamento")}
                          style={{
                            background: 'rgba(220, 20, 60, 0.8)',
                            color: 'white',
                            border: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontFamily: 'MedievalSharp, cursive'
                          }}
                          title="Rimuovi dai preferiti"
                        >
                          ★ Rimuovi
                        </button>
                      </div>
                      
                      {doc.excerpt && (
                        <p style={{marginBottom: '1rem', lineHeight: '1.6', color: '#2c1810'}}>
                          {doc.excerpt}
                        </p>
                      )}
                      
                      <p style={{textAlign: 'right', fontStyle: 'italic', fontSize: '0.9rem', margin: '0'}}>
                        <Link 
                          href={`/${doc.type}/${doc.slug}`} 
                          style={{color: '#8B4513', textDecoration: 'underline'}}
                        >
                          leggi documento &gt;&gt;
                        </Link>
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <h2>📖 Nessun documento preferito</h2>
              <p>
                Non hai ancora aggiunto alcun documento ai preferiti.
                <br />
                Clicca sul pulsante "☆ AGGIUNGI AI PREFERITI" durante la lettura di un documento per aggiungerlo qui.
              </p>
              <div style={{marginTop: '2rem'}}>
                <Link 
                  href="/ambientazione" 
                  style={{
                    color: '#8B4513', 
                    textDecoration: 'underline',
                    marginRight: '2rem'
                  }}
                >
                  Sfoglia Ambientazione
                </Link>
                <Link 
                  href="/regolamento" 
                  style={{
                    color: '#8B4513', 
                    textDecoration: 'underline'
                  }}
                >
                  Sfoglia Regolamento
                </Link>
              </div>
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </DocumentsLayout>
  );
}