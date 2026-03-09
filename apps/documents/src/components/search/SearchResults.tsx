'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AIAnswer, AIEnrichment, AIReading } from '@/hooks/useSearch';
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
  aiEnrichments?: AIEnrichment[];
  aiReading?: AIReading;
  aiLoading?: boolean;
  aiComplete?: boolean;
  onClose: () => void;
}

const PLACEHOLDER_TEXT =
  'Le antiche cronache narrano di eventi straordinari che hanno plasmato il destino di queste terre. ' +
  'I saggi custodiscono memorie che risalgono ad ere dimenticate, quando le forze primordiali ' +
  'si manifestavano con una potenza tale da mutare il corso stesso della storia. ' +
  'Nei tomi della biblioteca si celano risposte a domande che pochi osano formulare.';

function AIAnswerSkeleton() {
  return (
    <div className={styles.aiAnswerCard}>
      <div className={styles.aiAnswerHeader}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z" />
          <path d="M10 21h4" />
        </svg>
        <span>Il Bibliotecario sta pensando...</span>
      </div>
      <div className={styles.aiAnswerBlurred}>
        {PLACEHOLDER_TEXT}
      </div>
    </div>
  );
}

function AIAnswerCard({ aiAnswer, onClose }: { aiAnswer: AIAnswer; onClose: () => void }) {
  const usedSources = aiAnswer.sources.filter(s => s.used);

  return (
    <div className={`${styles.aiAnswerCard} ${styles.aiAnswerRevealed}`}>
      <div className={styles.aiAnswerHeader}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z" />
          <path d="M10 21h4" />
        </svg>
        <span>Il Bibliotecario risponde...</span>
      </div>

      <div className={styles.aiAnswerText}>
        <div>{aiAnswer.answer}</div>
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

function AIEnrichmentBlock({ enrichment, onClose }: { enrichment: AIEnrichment; onClose: () => void }) {
  return (
    <div className={styles.aiEnrichmentBlock}>
      <div className={styles.aiEnrichmentHeader}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span>Ho trovato altre info in </span>
        {enrichment.source.fullPath ? (
          <Link
            href={enrichment.source.fullPath}
            className={styles.aiSourceLink}
            onClick={onClose}
          >
            {enrichment.source.title}
          </Link>
        ) : (
          <strong>{enrichment.source.title}</strong>
        )}
      </div>
      <div className={styles.aiEnrichmentText}>
        {enrichment.enrichment}
      </div>
    </div>
  );
}

function AIReadingIndicator({ reading, onClose }: { reading: AIReading; onClose: () => void }) {
  return (
    <div className={styles.aiReadingIndicator}>
      <div className={styles.aiReadingDots}>
        <span /><span /><span />
      </div>
      <span>Sto leggendo </span>
      {reading.fullPath ? (
        <Link
          href={reading.fullPath}
          className={styles.aiSourceLink}
          onClick={onClose}
        >
          {reading.title}
        </Link>
      ) : (
        <strong>{reading.title}</strong>
      )}
      <span>...</span>
    </div>
  );
}

function ResultItem({ result, onClose }: { result: SearchResult; onClose: () => void }) {
  return (
    <li className={styles.resultItem}>
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

        {result.document.isDraft && (
          <span className={styles.draftBadge}>🚧 Bozza</span>
        )}
      </Link>
    </li>
  );
}

function ResultsList({ results, onClose }: { results: SearchResult[]; onClose: () => void }) {
  return (
    <ul className={styles.resultsList}>
      {results.map((result) => (
        <ResultItem key={result.document._id} result={result} onClose={onClose} />
      ))}
    </ul>
  );
}

function CollapsibleResultsList({ results, onClose }: { results: SearchResult[]; onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.collapsibleResults}>
      <button
        type="button"
        className={styles.collapsibleToggle}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.collapsibleChevron} ${isOpen ? styles.collapsibleChevronOpen : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>Documenti correlati ({results.length})</span>
      </button>

      {isOpen && (
        <ul className={styles.resultsList}>
          {results.map((result) => (
            <ResultItem key={result.document._id} result={result} onClose={onClose} />
          ))}
        </ul>
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
  aiEnrichments = [],
  aiReading,
  aiLoading = false,
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

  if (results.length === 0 && !aiAnswer && !aiLoading) {
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

  const showAISkeleton = aiLoading && !aiAnswer;
  const showAIAnswer = !!aiAnswer;
  const showEnrichments = aiEnrichments.length > 0;
  const showReading = !!aiReading && aiLoading;
  const hasAI = showAIAnswer || showAISkeleton;

  return (
    <div className={styles.resultsDropdown}>
      <div className={styles.resultsHeader}>
        <span className={styles.resultsCount}>
          {totalResults} risultat{totalResults !== 1 ? 'i' : 'o'}
        </span>
        <span className={styles.resultsQuery}>per "{query}"</span>
      </div>

      {showAISkeleton && <AIAnswerSkeleton />}
      {showAIAnswer && <AIAnswerCard aiAnswer={aiAnswer} onClose={onClose} />}
      {showEnrichments && (
        <div className={styles.aiEnrichments}>
          {aiEnrichments.map((enrichment) => (
            <AIEnrichmentBlock
              key={enrichment.step}
              enrichment={enrichment}
              onClose={onClose}
            />
          ))}
        </div>
      )}
      {showReading && <AIReadingIndicator reading={aiReading} onClose={onClose} />}

      {results.length > 0 && (
        hasAI
          ? <CollapsibleResultsList results={results} onClose={onClose} />
          : <ResultsList results={results} onClose={onClose} />
      )}

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
