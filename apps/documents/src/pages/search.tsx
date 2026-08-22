/**
 * Search Results Page
 *
 * Full-text search across all public documents.
 * Accessible via /search?q=query
 *
 * @module pages/search
 */

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

import { SEO } from '@/components/SEO';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { API_CONFIG } from '@/constants/config';
import { logger } from '@/lib/logger';
import styles from '@/styles/pages/SearchPage.module.scss';
import { DOCUMENT_TYPE_CONFIGS, type DocumentType } from '@/types/document';

/** Classe SCSS del badge per tipo (vedi SearchPage.module.scss). */
const TYPE_BADGE_CLASS: Record<DocumentType, string | undefined> = {
  ambientazione: styles.typeAmbientazione,
  regolamento: styles.typeRegolamento,
  'manuale-master': styles.typeManualeMaster,
};

interface SearchResult {
  title: string;
  url: string;
  type: DocumentType;
}

interface SearchResponse {
  success: boolean;
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

      if (data.success && data.data) {
        setResults(data.data.results);
      } else {
        setError(data.error || 'Errore durante la ricerca');
      }

      setSearchPerformed(true);
    } catch (err) {
      logger.error('[Ricerca] Errore', { error: err });
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

      <div className={`search-page ${styles.page}`}>
        <h1>Ricerca Documenti</h1>

        {/* Search Query Display */}
        {q && (
          <p className={styles.lead}>
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
              <div className={styles.emptyState}>
                <p>Nessun risultato trovato per "{q}"</p>
                <p className={styles.emptyHint}>
                  Prova con termini diversi o verifica l'ortografia.
                </p>
              </div>
            ) : (
              <div className="search-results">
                <p className={styles.resultsLead}>
                  {results.length} {results.length === 1 ? 'risultato' : 'risultati'}
                </p>

                <ul className={styles.resultList}>
                  {results.map((result, index) => (
                    <li key={`${result.url}-${index}`} className={styles.resultItem}>
                      <div className={styles.resultCard}>
                        <Link
                          href={result.url}
                          className={styles.resultLink}
                        >
                          {result.title}
                        </Link>
                        <div className={styles.resultMeta}>
                          <span
                            className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[result.type] ?? ''}`}
                          >
                            {DOCUMENT_TYPE_CONFIGS[result.type].label}
                          </span>
                          <span className={styles.resultUrl}>{result.url}</span>
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
          <div className={styles.emptyState}>
            <p>Inserisci un termine di ricerca per iniziare.</p>
          </div>
        )}
      </div>
    </>
  );
}
