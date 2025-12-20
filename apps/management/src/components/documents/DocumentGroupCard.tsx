// =============================================================================
// Document Group Card Component
// =============================================================================

import React, { useState, useCallback } from 'react';
import { DocumentGroupWithDocuments, Document, DocumentGroup, DocumentVisibility, AuthContext } from '@/types';
import { DocumentCard } from './DocumentCard';
import { ArrowDocumentList } from './ArrowDocumentList';
import styles from '@/styles/components/documents/DocumentGroupCard.module.scss';

interface DocumentGroupCardProps {
  group: DocumentGroupWithDocuments;
  authContext: AuthContext;
  onEditDocument: (document: Document) => void;
  onEditContent?: (document: Document) => void;
  onDeleteDocument: (document: Document) => void;
  onDeleteGroup: (group: DocumentGroup) => void;
  onToggleVisibility: (documentId: string, visibility: DocumentVisibility) => void;
  onToggleGroupActive: (groupId: string, isActive: boolean) => void;
  onReorderDocuments: (groupId: string, documentIds: string[]) => void;
}

export function DocumentGroupCard({
  group,
  authContext,
  onEditDocument,
  onEditContent,
  onDeleteDocument,
  onDeleteGroup,
  onToggleVisibility,
  onToggleGroupActive,
  onReorderDocuments
}: DocumentGroupCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const canEdit = authContext.user?.effectivePermissions?.documents?.detail?.update;
  const canDelete = authContext.user?.effectivePermissions?.documents?.detail?.delete;
  const canManageGroups = authContext.user?.effectivePermissions?.documents?.detail?.manage_groups;

  const handleMoveUp = useCallback((documentId: string, currentIndex: number) => {
    if (currentIndex === 0 || !canEdit || isReordering) return;
    
    const reorderedDocuments = Array.from(group.documents);
    const [moved] = reorderedDocuments.splice(currentIndex, 1);
    reorderedDocuments.splice(currentIndex - 1, 0, moved);

    const documentIds = reorderedDocuments.map(doc => doc.id);
    setIsReordering(true);
    onReorderDocuments(group.id, documentIds);
    setIsReordering(false);
  }, [group.documents, group.id, onReorderDocuments, canEdit, isReordering]);

  const handleMoveDown = useCallback((documentId: string, currentIndex: number) => {
    if (currentIndex === group.documents.length - 1 || !canEdit || isReordering) return;
    
    const reorderedDocuments = Array.from(group.documents);
    const [moved] = reorderedDocuments.splice(currentIndex, 1);
    reorderedDocuments.splice(currentIndex + 1, 0, moved);

    const documentIds = reorderedDocuments.map(doc => doc.id);
    setIsReordering(true);
    onReorderDocuments(group.id, documentIds);
    setIsReordering(false);
  }, [group.documents, group.id, onReorderDocuments, canEdit, isReordering]);

  const getVisibilityIcon = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return '🌍';
      case 'ristretto': return '🔒';
      case 'spento': return '🚫';
      default: return '❓';
    }
  };

  const getVisibilityColor = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return 'success';
      case 'ristretto': return 'warning';
      case 'spento': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className={`${styles.groupCard} ${!group.isActive ? styles.inactive : ''}`}>
      {/* Group Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Espandi gruppo' : 'Comprimi gruppo'}
          >
            <span className={`${styles.collapseIcon} ${isCollapsed ? styles.collapsed : ''}`}>
              ▼
            </span>
          </button>

          <div className={styles.groupInfo}>
            <h3 className={styles.groupName}>
              {group.name}
              {!group.isActive && (
                <span className={styles.inactiveLabel}>DISATTIVATO</span>
              )}
            </h3>
            {group.description && (
              <p className={styles.groupDescription}>{group.description}</p>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.stats}>
            <span className={styles.stat}>
              {group.documents.length} {group.documents.length === 1 ? 'documento' : 'documenti'}
            </span>
          </div>

          <div className={styles.actions}>
            {canManageGroups && (
              <button
                className={`${styles.actionButton} ${styles.toggleActive}`}
                onClick={() => onToggleGroupActive(group.id, !group.isActive)}
                title={group.isActive ? 'Disattiva gruppo' : 'Attiva gruppo'}
              >
                {group.isActive ? '👁️' : '🙈'}
              </button>
            )}

            {canDelete && (
              <button
                className={`${styles.actionButton} ${styles.delete}`}
                onClick={() => {
                  console.log('🗑️ Delete group clicked:', { 
                    group: group.name, 
                    documentsLength: group.documents.length,
                    canDelete,
                    canManageGroups
                  });
                  onDeleteGroup(group);
                }}
                title={`Elimina gruppo e tutti i suoi ${group.documents.length} documenti`}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Documents List */}
      {!isCollapsed && (
        <div className={styles.documentsSection}>
          {group.documents.length > 0 ? (
            <ArrowDocumentList
              group={group}
              authContext={authContext}
              canEdit={canEdit}
              isReordering={isReordering}
              onEditDocument={onEditDocument}
              onEditContent={onEditContent}
              onDeleteDocument={onDeleteDocument}
              onToggleVisibility={onToggleVisibility}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ) : (
            <div className={styles.emptyDocuments}>
              <span className={styles.emptyIcon}>📄</span>
              <p>Nessun documento in questo gruppo</p>
            </div>
          )}
        </div>
      )}

      {/* Loading/Reordering Overlay */}
      {isReordering && (
        <div className={styles.reorderingOverlay}>
          <div className={styles.spinner} />
          <p>Riordinando...</p>
        </div>
      )}
    </div>
  );
}