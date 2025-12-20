import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { getDocument, getDocuments, Document, DocumentContent, isDocumentFavorited, addDocumentToFavorites, removeDocumentFromFavorites } from '@/lib/documentApi';
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';
import styles from '@/styles/pages/DocumentView.module.scss';

export default function RegolamentoDocument() {
  const router = useRouter();
  const { slug } = router.query;
  
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authContext, setAuthContext] = useState<AuthContext>({ isAuthenticated: false, tokens: {} });
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

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

  // Check if document is favorited
  useEffect(() => {
    if (!slug || typeof slug !== 'string' || !authContext.isAuthenticated) return;

    async function checkFavoriteStatus() {
      try {
        const favorited = await isDocumentFavorited('regolamento', slug as string);
        setIsFavorited(favorited);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    }

    checkFavoriteStatus();
  }, [slug, authContext.isAuthenticated]);

  // Fetch document and all documents for navigation
  useEffect(() => {
    if (!slug || typeof slug !== 'string') return;
    
    async function fetchDocumentAndList() {
      try {
        setLoading(true);
        
        // Fetch both the document content and the full list for navigation
        const [content, allDocs] = await Promise.all([
          getDocument('regolamento', slug as string),
          getDocuments('regolamento')
        ]);
        
        setDocumentContent(content);
        setAllDocuments(allDocs);
        setError(null);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Documento non trovato o errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocumentAndList();
  }, [slug]);

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

  const handleFavoriteToggle = async () => {
    if (!slug || typeof slug !== 'string' || !authContext.isAuthenticated || favoriteLoading) return;

    try {
      setFavoriteLoading(true);
      
      if (isFavorited) {
        await removeDocumentFromFavorites('regolamento', slug as string);
        setIsFavorited(false);
      } else {
        await addDocumentToFavorites('regolamento', slug as string);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Get previous and next documents for navigation
  const getNavigationDocuments = () => {
    if (!documentContent || allDocuments.length === 0) {
      return { prevDoc: null, nextDoc: null };
    }

    // Group documents by group field, then sort by title within each group
    const groupedDocs: Record<string, Document[]> = {};
    allDocuments.forEach(doc => {
      const group = doc.group || 'Altri';
      if (!groupedDocs[group]) {
        groupedDocs[group] = [];
      }
      groupedDocs[group].push(doc);
    });

    // Sort documents within each group by title
    Object.keys(groupedDocs).forEach(group => {
      groupedDocs[group].sort((a, b) => a.title.localeCompare(b.title));
    });

    // Create ordered list of all documents
    const orderedDocs: Document[] = [];
    const sortedGroups = Object.keys(groupedDocs).sort();
    sortedGroups.forEach(group => {
      orderedDocs.push(...groupedDocs[group]);
    });

    // Find current document index
    const currentIndex = orderedDocs.findIndex(doc => doc.slug === documentContent.document.slug);
    
    if (currentIndex === -1) {
      return { prevDoc: null, nextDoc: null };
    }

    const prevDoc = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
    const nextDoc = currentIndex < orderedDocs.length - 1 ? orderedDocs[currentIndex + 1] : null;

    return { prevDoc, nextDoc };
  };

  if (loading) {
    return (
      <DocumentsLayout authContext={authContext}>
        <div className={styles.documentContainer}>
          <div className={styles.loadingState}></div>
        </div>
      </DocumentsLayout>
    );
  }

  if (error || !documentContent) {
    return (
      <DocumentsLayout authContext={authContext}>
        <Head>
          <title>Documento non trovato - TenpennyNovels</title>
        </Head>
        <div className={styles.documentContainer}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>❌</div>
            <h2>Documento non trovato</h2>
            <p>{error || 'Il documento richiesto non è stato trovato.'}</p>
            <Link href="/regolamento" className={styles.backButton}>
              ← Torna all'elenco regolamento
            </Link>
          </div>
        </div>
      </DocumentsLayout>
    );
  }

  const { document, sections } = documentContent;

  return (
    <DocumentsLayout authContext={authContext}>
      <Head>
        <title>{document.title} - TenpennyNovels Regolamento</title>
        <meta 
          name="description" 
          content={document.description || `Documento di regolamento: ${document.title}`}
        />
      </Head>

      <div className={styles.documentContainer}>
        {/* Document Header */}
        <header className={styles.documentHeader}>
          <nav className={styles.breadcrumb}>
            <Link href="/">Documenti</Link>
            <span className={styles.separator}>›</span>
            <Link href="/regolamento">Regolamento</Link>
            <span className={styles.separator}>›</span>
            <span className={styles.currentPage}>{document.title}</span>
          </nav> 
        </header>

        {/* Document Content */}
        <div className="layout">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ margin: 0 }}>♦ {document.title} ♦</h1>
            {authContext.isAuthenticated && (
              <button
                onClick={handleFavoriteToggle}
                disabled={favoriteLoading}
                style={{
                  background: isFavorited ? 'rgba(184, 134, 11, 0.8)' : 'rgba(139, 69, 19, 0.8)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: favoriteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: 'MedievalSharp, cursive',
                  opacity: favoriteLoading ? 0.6 : 1
                }}
                title={isFavorited ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                {favoriteLoading ? '⏳' : (isFavorited ? '★' : '☆')} {isFavorited ? 'RIMUOVI' : 'AGGIUNGI'}
              </button>
            )}
          </div>
          {sections.map((section, index) => (
            <div key={section.id?.toString() || index} className="paper">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: section.content.replace(/\n/g, '<br/>') 
                }}
              />
            </div>
          ))}
        </div>

        {/* Document Footer */}
        <footer className={styles.documentFooter}>
          <div className={styles.navigation}>
            {(() => {
              const { prevDoc, nextDoc } = getNavigationDocuments();
              return (
                <>
                  {prevDoc ? (
                    <Link href={`/regolamento/${prevDoc.slug}`} className={styles.backButton}>
                      ← {prevDoc.title}
                    </Link>
                  ) : (
                    <span className={styles.backButton} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      ← Primo documento
                    </span>
                  )}
                  
                  {nextDoc ? (
                    <Link href={`/regolamento/${nextDoc.slug}`} className={styles.nextButton}>
                      {nextDoc.title} →
                    </Link>
                  ) : (
                    <span className={styles.nextButton} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      Ultimo documento →
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          
          <div className={styles.lastUpdated}>
            <p>Ultima modifica: {formatDate(document.lastUpdated)}</p>
            <p>Creato da: {document.createdBy.username}</p>
          </div>
        </footer>
      </div>
    </DocumentsLayout>
  );
}