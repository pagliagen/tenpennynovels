/**
 * Search Results Page
 *
 * Full-text search across all public documents.
 * Accessible via /search?q=query
 *
 * @module pages/search
 */

import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { API_CONFIG } from '@/constants/config';

interface SearchResult {
  title: string;
  url: string;
  type: 'ambientazione' | 'regolamento';
}

interface SearchResponse {
  result: boolean;
  data?: {
    query: string;
    results: SearchResult[];
    count: number;
  };
  error?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  useEffect(() => {
    if (q && typeof q === 'string') {
      performSearch(q);
    }
  }, [q]);

  const performSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setSearchPerformed(false);

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/documents/search?q=${encodeURIComponent(query)}`
      );

      const data: SearchResponse = await response.json();

      if (data.result && data.data) {
        setResults(data.data.results);
      } else {
        setError(data.error || 'Errore durante la ricerca');
      }

      setSearchPerformed(true);
    } catch (err) {
      console.error('[Ricerca] Errore:', err);
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = q ? `Cerca: ${q} - Ten Penny Novels` : 'Cerca - Ten Penny Novels';
  const pageDescription = q
    ? `Risultati ricerca per "${q}" nei documenti di Ten Penny Novels`
    : 'Cerca tra i documenti di ambientazione e regolamento';

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDescription}
        noindex  // Search results pages should not be indexed
      />

      <div className="search-page" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Ricerca Documenti</h1>

        {/* Search Query Display */}
        {q && (
          <p style={{ marginBottom: '2rem', color: '#666' }}>
            Risultati per: <strong>{q}</strong>
          </p>
        )}

        {/* Loading State */}
        {loading && <LoadingSpinner message="Ricerca in corso..." />}

        {/* Error State */}
        {error && !loading && (
          <ErrorMessage
            message={error}
            onRetry={() => q && typeof q === 'string' && performSearch(q)}
          />
        )}

        {/* Results */}
        {!loading && !error && searchPerformed && (
          <>
            {results.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                <p>Nessun risultato trovato per "{q}"</p>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  Prova con termini diversi o verifica l'ortografia.
                </p>
              </div>
            ) : (
              <div className="search-results">
                <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                  {results.length} {results.length === 1 ? 'risultato' : 'risultati'}
                </p>

                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {results.map((result, index) => (
                    <li key={`${result.url}-${index}`} style={{ marginBottom: '1.5rem' }}>
                      <div style={{
                        padding: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        transition: 'border-color 0.2s'
                      }}>
                        <Link
                          href={result.url}
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            color: '#333',
                            textDecoration: 'none'
                          }}
                        >
                          {result.title}
                        </Link>
                        <div style={{
                          marginTop: '0.5rem',
                          fontSize: '0.85rem',
                          color: '#666'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            background: result.type === 'ambientazione' ? '#e3f2fd' : '#f3e5f5',
                            borderRadius: '3px',
                            marginRight: '0.5rem'
                          }}>
                            {result.type === 'ambientazione' ? 'Ambientazione' : 'Regolamento'}
                          </span>
                          <span style={{ color: '#999' }}>{result.url}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* No Query State */}
        {!q && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>Inserisci un termine di ricerca per iniziare.</p>
          </div>
        )}
      </div>
    </>
  );
}
