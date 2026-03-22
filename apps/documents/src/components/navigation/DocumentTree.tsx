/**
 * DocumentTree Component
 *
 * Recursive tree navigation for documents grouped by category.
 * Supports collapsible groups with expand/collapse all controls.
 *
 * @module components/navigation/DocumentTree
 * @since 1.0.0
 */

'use client';

import { useDocumentGroups } from '@/hooks/useDocumentGroups';
import type { Document } from '@/types/document';
import { DocumentGroup } from './DocumentGroup';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import styles from '@/styles/components/navigation/DocumentTree.module.scss';

interface DocumentTreeProps {
  documents: Document[];
  isLoading?: boolean;
}

export function DocumentTree({ documents, isLoading }: DocumentTreeProps): JSX.Element {
  const { groups, toggleGroup, collapseAll, expandAll, hasGroups } = useDocumentGroups(documents);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="small" message="Caricamento..." />
      </div>
    );
  }

  if (!hasGroups) {
    return (
      <div className={styles.emptyState}>
        <p>Nessun documento disponibile</p>
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      {/* Controlli espandi/comprimi tutto */}
      {groups.length > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlButton}
            onClick={expandAll}
            aria-label="Espandi tutti i gruppi"
          >
            ▼ Espandi tutto
          </button>
          <button
            type="button"
            className={styles.controlButton}
            onClick={collapseAll}
            aria-label="Comprimi tutti i gruppi"
          >
            ▶ Comprimi tutto
          </button>
        </div>
      )}

      {/* Document Groups */}
      <div className={styles.groupsContainer}>
        {groups.map((group) => (
          <DocumentGroup key={group.name} group={group} onToggle={toggleGroup} />
        ))}
      </div>
    </div>
  );
}
