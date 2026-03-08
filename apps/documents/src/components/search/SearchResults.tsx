/**
 * SearchResults Component
 *
 * Displays semantic search results with match scores.
 * When AI provides an answer, renders it above the document list.
 *
 * @module components/search/SearchResults
 * @since 1.0.0
 */

'use client';

import Link from 'next/link';
import type { AIAnswer } from '@/hooks/useSearch';
import styles from '@/styles/components/SearchResults.module.scss';

interface SearchResult {
  document: {
    _id: string;
    slug: string;
    title: string;
    content: string;
    description?: string;
    tags: string[];
    isDraft: boolean;
  };
  route: {
    path: string;
    type: 'ambientazione' | 'regolamento';
    subtypeTitle: string;
    anchor: string;
    fullPath: string;
  };
  matchLevel: number;
  matchHeading: string;
  similarity: number;
  matchScore: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  totalResults: number;
  query: string;
  isLoading: boolean;
  aiAnswer?: AIAnswer;
  onClose: () => void;
}

function AIAnswerCard({ aiAnswer, onClose }: { aiAnswer: AIAnswer; onClose: () => void }) {
  const usedSources = aiAnswer.sources.filter(s => s.used);

  return (
    <div className={styles.aiAnswerCard}>
      <div className={styles.aiAnswerHeader}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z" />
          <path d="M10 21h4" />
        </svg>
        <span>Risposta AI</span>
      </div>

      <div className={styles.aiAnswerText}>
        {aiAnswer.answer}
      </div>

      {usedSources.length > 0 && (
        <div className={styles.aiSources}>
          <span className={styles.aiSourcesLabel}>Riferimenti:</span>
          {usedSources.map((source, i) => (
            source.fullPath ? (
              <Link
                key={i}
                href={source.fullPath}
                className={styles.aiSourceLink}
                onClick={onClose}
              >
                {source.title || source.heading}
              </Link>
            ) : (
              <span key={i} className={styles.aiSourceLink}>
                {source.title || source.heading}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchResults({
  results,
  totalResults,
  query,
  isLoading,
  aiAnswer,
  onClose,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className={styles.resultsDropdown}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Ricerca in corso...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0 && !aiAnswer) {
    return (
      <div className={styles.resultsDropdown}>
        <div className={styles.noResults}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
            <path
              d="M18 28c0-2 2-4 6-4s6 2 6 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
            <circle cx="30" cy="18" r="1.5" fill="currentColor" />
          </svg>
          <p className={styles.noResultsTitle}>Nessun risultato</p>
          <p className={styles.noResultsText}>
            Nessun documento trovato per "<strong>{query}</strong>"
          </p>
          <p className={styles.noResultsHint}>Prova con parole diverse o più generiche</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.resultsDropdown}>
      <div className={styles.resultsHeader}>
        <span className={styles.resultsCount}>
          {totalResults} risultat{totalResults !== 1 ? 'i' : 'o'}
        </span>
        <span className={styles.resultsQuery}>per "{query}"</span>
      </div>

      {aiAnswer && <AIAnswerCard aiAnswer={aiAnswer} onClose={onClose} />}

      <ul className={styles.resultsList}>
        {results.map((result) => (
          <li key={result.document._id} className={styles.resultItem}>
            <Link
              href={result.route.fullPath}
              className={styles.resultLink}
              onClick={onClose}
            >
              <div className={styles.resultHeader}>
                <h4 className={styles.resultTitle}>{result.document.title}</h4>
                <span
                  className={styles.matchScore}
                  title={`Similarity: ${result.similarity.toFixed(3)}`}
                >
                  {result.matchScore}
                </span>
              </div>

              <p className={styles.resultBreadcrumb}>
                <span className={styles.breadcrumbType}>
                  {result.route.type === 'ambientazione' && '🌍 Ambientazione'}
                  {result.route.type === 'regolamento' && '📜 Regolamento'}
                </span>
                {result.route.subtypeTitle && (
                  <>
                    <span className={styles.breadcrumbSeparator}>›</span>
                    <span className={styles.breadcrumbPath}>{result.route.subtypeTitle}</span>
                  </>
                )}
                <span className={styles.breadcrumbSeparator}>›</span>
                <span className={styles.breadcrumbPath}>{result.document.title}</span>
              </p>

              {result.matchHeading && (
                <p className={styles.matchSection}>
                  <span className={styles.matchSectionIcon}>§</span>
                  {result.matchHeading}
                </p>
              )}
 
              {result.document.content && (
                <p className={styles.resultContent}>
                  {result.document.content.replace(/<[^>]*>/g, '')}
                </p>
              )}

              {result.document.tags.length > 0 && (
                <div className={styles.resultTags}>
                  {result.document.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {result.document.isDraft && (
                <span className={styles.draftBadge}>🚧 Bozza</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.resultsFooter}>
        <kbd>↑</kbd>
        <kbd>↓</kbd>
        <span>per navigare</span>
        <kbd>↵</kbd>
        <span>per aprire</span>
        <kbd>esc</kbd>
        <span>per chiudere</span>
      </div>
    </div>
  );
}
