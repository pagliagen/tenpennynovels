/**
 * DocumentNode - Memoized component for document rendering
 * Displays document hierarchy with subtype info
 */

import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import styles from './DocumentTreeView.module.scss';
import type { DocumentTreeNode } from '@/types/api/Document';

interface DocumentNodeProps {
  doc: DocumentTreeNode;
  depth: number;
  isExpanded: boolean;
  expandedDocs: Set<string>;
  onToggle: (docId: string) => void;
  onEdit: (docId: string) => void;
  onEditHierarchical: (docId: string) => void;
  onDelete: (docId: string) => void;
  onToggleVisibility: (docId: string) => void;
  onToggleDraft: (docId: string) => void;
  onCreateChildDocument: (parentDocId: string) => void;
}

export const DocumentNode: React.FC<DocumentNodeProps> = React.memo(({
  doc,
  depth,
  isExpanded,
  expandedDocs,
  onToggle,
  onEdit,
  onEditHierarchical,
  onDelete,
  onToggleVisibility,
  onToggleDraft,
  onCreateChildDocument
}) => {
  const hasChildren = doc.children && doc.children.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const getDocumentUrl = (): string | null => {
    if (!doc.path) return null;

    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://documenti.tenpennynovels.com'
      : 'http://localhost:4003';
    return `${baseUrl}/${doc.subtype ? (doc as any).type || 'ambientazione' : 'ambientazione'}/${doc.path}`;
  };

  const documentUrl = getDocumentUrl();

  const handleCopyUrl = async () => {
    if (!documentUrl) return;
    try {
      await navigator.clipboard.writeText(documentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className={styles.documentNode} style={{ paddingLeft: `${depth * 24}px` }}>
      <div className={styles.documentRow}>
        {hasChildren && (
          <button
            onClick={() => onToggle(doc._id)}
            className={styles.expandButton}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className={styles.expandPlaceholder}></span>}

        <span className={styles.icon}>📝</span>

        <span className={styles.title}>
          {doc.title}
          {doc.isDraft && <span className={styles.draftBadge}>Bozza</span>}
          {!doc.visible && <span className={styles.hiddenBadge}>Nascosto</span>}
          {!doc.isPublic && <span className={styles.badge}>Privato</span>}
        </span>

        {/* Subtype badge */}
        {doc.subtype && (
          <span className={styles.badge} title={`Sottotipo: ${doc.subtype.title}`}>
            {doc.subtype.title}
          </span>
        )}

        {/* URL Column with copy-to-clipboard */}
        {documentUrl ? (
          <button
            onClick={handleCopyUrl}
            className={styles.urlButton}
            title="Clicca per copiare URL"
          >
            <span className={styles.urlText}>{doc.path}</span>
            <span className={styles.copyIcon}>{copied ? '✓' : '📋'}</span>
          </button>
        ) : (
          <span className={styles.urlPlaceholder}>-</span>
        )}

        <span className={styles.order}>#{doc.order}</span>

        {/* Three-dots menu */}
        <div className={styles.documentActions} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={styles.menuButton}
            aria-label="Azioni"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className={styles.actionMenu}>
              <button
                onClick={() => {
                  onCreateChildDocument(doc._id);
                  setMenuOpen(false);
                }}
                className={styles.menuItem}
              >
                ➕ Crea Sottodocumento
              </button>

              <hr className={styles.menuDivider} />

              <button
                onClick={() => { onEdit(doc._id); setMenuOpen(false); }}
                className={styles.menuItem}
              >
                ✏️ Modifica Documento
              </button>
              {hasChildren && (
                <button
                  onClick={() => { onEditHierarchical(doc._id); setMenuOpen(false); }}
                  className={styles.menuItem}
                >
                  📚 Modifica Gerarchica
                </button>
              )}
              <button
                onClick={() => { onToggleVisibility(doc._id); setMenuOpen(false); }}
                className={styles.menuItem}
              >
                {doc.visible ? '👁️ Nascondi' : '👁️‍🗨️ Mostra'}
              </button>
              <button
                onClick={() => { onToggleDraft(doc._id); setMenuOpen(false); }}
                className={styles.menuItem}
              >
                {doc.isDraft ? '✓ Pubblica' : '📋 Segna Bozza'}
              </button>
              <button
                onClick={() => { onDelete(doc._id); setMenuOpen(false); }}
                className={classNames(styles.menuItem, styles.danger)}
              >
                🗑️ Elimina Documento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
