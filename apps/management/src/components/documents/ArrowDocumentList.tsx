// =============================================================================
// Arrow Document List Component - Simple reordering with up/down arrows
// =============================================================================

import React from 'react';
import { DocumentGroupWithDocuments, Document, DocumentVisibility, AuthContext } from '@/types';
import { DocumentCard } from './DocumentCard';
import styles from '@/styles/components/documents/DocumentGroupCard.module.scss';

interface ArrowDocumentListProps {
  group: DocumentGroupWithDocuments;
  authContext: AuthContext;
  canEdit: boolean;
  isReordering: boolean;
  onEditDocument: (document: Document) => void;
  onEditContent?: (document: Document) => void;
  onDeleteDocument: (document: Document) => void;
  onToggleVisibility: (documentId: string, visibility: DocumentVisibility) => void;
  onMoveUp: (documentId: string, currentIndex: number) => void;
  onMoveDown: (documentId: string, currentIndex: number) => void;
}

export default function ArrowDocumentList({
  group,
  authContext,
  canEdit,
  isReordering,
  onEditDocument,
  onEditContent,
  onDeleteDocument,
  onToggleVisibility,
  onMoveUp,
  onMoveDown
}: ArrowDocumentListProps) {
  return (
    <div className={styles.documentsList}>
      {group.documents.map((document, index) => (
        <div
          key={document.id}
          className={styles.documentWrapper}
        >
          <div className={styles.arrowControls}>
            <button
              className={styles.arrowButton}
              onClick={() => onMoveUp(document.id, index)}
              disabled={!canEdit || isReordering || index === 0}
              title="Sposta in su"
              type="button"
            >
              ↑
            </button>
            <button
              className={styles.arrowButton}
              onClick={() => onMoveDown(document.id, index)}
              disabled={!canEdit || isReordering || index === group.documents.length - 1}
              title="Sposta in giù"
              type="button"
            >
              ↓
            </button>
          </div>
          <DocumentCard
            document={document}
            authContext={authContext}
            onEdit={() => onEditDocument(document)}
            onEditContent={onEditContent ? () => onEditContent(document) : undefined}
            onDelete={() => onDeleteDocument(document)}
            onToggleVisibility={(visibility) => 
              onToggleVisibility(document.id, visibility)
            }
          />
        </div>
      ))}
    </div>
  );
}

// Also export as named export for flexibility
export { ArrowDocumentList };