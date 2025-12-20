// =============================================================================
// Document Card Component
// =============================================================================

import React, { useState } from 'react';
import { Document, DocumentVisibility, AuthContext } from '@/types';
import styles from '@/styles/components/documents/DocumentCard.module.scss';

interface DocumentCardProps {
  document: Document;
  authContext: AuthContext;
  onEdit: () => void;
  onEditContent?: () => void;
  onDelete: () => void;
  onToggleVisibility: (visibility: DocumentVisibility) => void;
  isDragging?: boolean;
}

export function DocumentCard({
  document,
  authContext,
  onEdit,
  onEditContent,
  onDelete,
  onToggleVisibility,
  isDragging = false
}: DocumentCardProps) {
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  const canEdit = authContext.user?.effectivePermissions?.documents?.detail?.update;
  const canDelete = authContext.user?.effectivePermissions?.documents?.detail?.delete;

  const getVisibilityIcon = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return '🌍';
      case 'ristretto': return '🔒';
      case 'spento': return '🚫';
      default: return '❓';
    }
  };

  const getVisibilityLabel = (visibility: DocumentVisibility) => {
    switch (visibility) {
      case 'pubblico': return 'Pubblico';
      case 'ristretto': return 'Riservato';
      case 'spento': return 'Nascosto';
      default: return 'Sconosciuto';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return '✅';
      case 'draft': return '📝';
      case 'archived': return '📦';
      default: return '❓';
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleVisibilityChange = (newVisibility: DocumentVisibility) => {
    onToggleVisibility(newVisibility);
    setShowVisibilityMenu(false);
  };

  return (
    <div className={`${styles.documentCard} ${isDragging ? styles.dragging : ''}`}>
      {/* Document Info */}
      <div className={styles.documentInfo}>
        <div className={styles.mainInfo}>
          <h4 className={styles.title}>
            <span className={styles.statusIcon}>
              {getStatusIcon(document.status)}
            </span>
            {document.title}
          </h4>

          {document.summary && (
            <p className={styles.summary}>{document.summary}</p>
          )}

          <div className={styles.metadata}>
            <span className={styles.author}>
              📝 {document.authorName}
            </span>
            <span className={styles.date}>
              🕒 {formatDate(document.updatedAt)}
            </span>
            {document.version > 1 && (
              <span className={styles.version}>
                v{document.version}
              </span>
            )}
          </div>

          {document.tags && document.tags.length > 0 && (
            <div className={styles.tags}>
              {document.tags.map((tag, index) => (
                <span key={index} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Visibility Badge */}
        <div className={styles.visibilitySection}>
          <div
            className={`${styles.visibilityBadge} ${styles[getVisibilityColor(document.visibility)]}`}
            onClick={() => canEdit && setShowVisibilityMenu(!showVisibilityMenu)}
            title={canEdit ? 'Clicca per cambiare visibilità' : `Visibilità: ${getVisibilityLabel(document.visibility)}`}
          >
            <span className={styles.visibilityIcon}>
              {getVisibilityIcon(document.visibility)}
            </span>
            <span className={styles.visibilityLabel}>
              {getVisibilityLabel(document.visibility)}
            </span>
            {canEdit && (
              <span className={styles.dropdownArrow}>▼</span>
            )}
          </div>

          {/* Visibility Menu */}
          {showVisibilityMenu && canEdit && (
            <div className={styles.visibilityMenu}>
              <button
                className={`${styles.visibilityOption} ${document.visibility === 'pubblico' ? styles.current : ''}`}
                onClick={() => handleVisibilityChange('pubblico')}
              >
                <span>🌍</span> Pubblico
              </button>
              <button
                className={`${styles.visibilityOption} ${document.visibility === 'ristretto' ? styles.current : ''}`}
                onClick={() => handleVisibilityChange('ristretto')}
              >
                <span>🔒</span> Riservato
              </button>
              <button
                className={`${styles.visibilityOption} ${document.visibility === 'spento' ? styles.current : ''}`}
                onClick={() => handleVisibilityChange('spento')}
              >
                <span>🚫</span> Nascosto
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        {canEdit && (
          <button
            className={`${styles.actionButton} ${styles.edit}`}
            onClick={onEdit}
            title="Modifica documento"
          >
            ✏️
          </button>
        )}

        <button
          className={`${styles.actionButton} ${styles.content}`}
          onClick={() => {
            console.log('Edit content for document:', document.id);
            if (onEditContent) {
              onEditContent();
            }
          }}
          title="Modifica contenuto"
          disabled={!canEdit || !onEditContent}
        >
          📝
        </button>

        {canDelete && (
          <button
            className={`${styles.actionButton} ${styles.delete}`}
            onClick={onDelete}
            title="Elimina documento"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Click overlay to close visibility menu */}
      {showVisibilityMenu && (
        <div
          className={styles.overlay}
          onClick={() => setShowVisibilityMenu(false)}
        />
      )}
    </div>
  );
}