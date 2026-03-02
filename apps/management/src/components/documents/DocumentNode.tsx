/**
 * DocumentNode - Memoized component for document rendering (DOCUMENTS-FIRST)
 * Displays document hierarchy with route status indicators
 * Three-dots menu with conditional route actions
 */

import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import styles from './DocumentTreeView.module.scss';
import type { DocumentWithRoute } from '@/types/api/Document';

interface DocumentNodeProps {
  doc: DocumentWithRoute;  // ← Changed from DocumentTreeNode
  depth: number;
  isExpanded: boolean;
  expandedDocs: Set<string>;
  onToggle: (docId: string) => void;
  // Document actions
  onEdit: (docId: string) => void;
  onEditHierarchical: (docId: string) => void;
  onDelete: (docId: string) => void;
  onToggleVisibility: (docId: string) => void;
  onToggleDraft: (docId: string) => void;
  // Route actions (NEW)
  onCreateRoute: (docId: string) => void;
  onEditRoute: (routeId: string) => void;
  onToggleRouteEnabled: (routeId: string) => void;
  onDeleteRoute: (routeId: string) => void;
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
  onCreateRoute,
  onEditRoute,
  onToggleRouteEnabled,
  onDeleteRoute
}) => {
  const hasChildren = doc.children && doc.children.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Costruisce l'URL completo del documento (se ha route)
  const getDocumentUrl = (): string | null => {
    if (!doc.route) return null;

    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://documenti.tenpennynovels.com'
      : 'http://localhost:4003';
    return `${baseUrl}/${doc.route.type}/${doc.route.path}`;
  };

  const documentUrl = getDocumentUrl();

  // Copia URL negli appunti
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

  // Close menu on click outside
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

        {/* Route indicator icon */}
        <span
          className={styles.routeIndicator}
          style={{ opacity: doc.route ? 1 : 0.3 }}
          title={doc.route ? `Route: ${doc.route.path}` : 'No route'}
        >
          🔗
        </span>

        <span className={styles.title}>
          {doc.title}
          {doc.isDraft && <span className={styles.draftBadge}>Bozza</span>}
          {!doc.visible && <span className={styles.hiddenBadge}>Nascosto</span>}
          {doc.route && !doc.route.enabled && <span className={styles.badge}>Route Disabilitata</span>}
        </span>

        {/* URL Column with copy-to-clipboard */}
        {documentUrl ? (
          <button
            onClick={handleCopyUrl}
            className={styles.urlButton}
            title="Clicca per copiare URL"
          >
            <span className={styles.urlText}>{documentUrl}</span>
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
              {/* Conditional route actions */}
              {!doc.route && (
                <button
                  onClick={() => {
                    onCreateRoute(doc._id);
                    setMenuOpen(false);
                  }}
                  className={styles.menuItem}
                >
                  🔗 Crea Rotta
                </button>
              )}
              {doc.route && (
                <>
                  <button
                    onClick={() => {
                      onEditRoute(doc.route!._id);
                      setMenuOpen(false);
                    }}
                    className={styles.menuItem}
                  >
                    ✏️ Modifica Rotta
                  </button>
                  <button
                    onClick={() => {
                      onToggleRouteEnabled(doc.route!._id);
                      setMenuOpen(false);
                    }}
                    className={styles.menuItem}
                  >
                    {doc.route.enabled ? '👁️ Disattiva Rotta' : '👁️‍🗨️ Attiva Rotta'}
                  </button>
                  <button
                    onClick={() => {
                      onDeleteRoute(doc.route!._id);
                      setMenuOpen(false);
                    }}
                    className={classNames(styles.menuItem, styles.danger)}
                  >
                    🗑️ Elimina Rotta
                  </button>
                </>
              )}

              {/* Separator */}
              <hr className={styles.menuDivider} />

              {/* Document actions (always available) */}
              <button
                onClick={() => {
                  onEdit(doc._id);
                  setMenuOpen(false);
                }}
                className={styles.menuItem}
              >
                ✏️ Modifica Documento
              </button>
              {hasChildren && (
                <button
                  onClick={() => {
                    onEditHierarchical(doc._id);
                    setMenuOpen(false);
                  }}
                  className={styles.menuItem}
                >
                  📚 Modifica Gerarchica
                </button>
              )}
              <button
                onClick={() => {
                  onToggleVisibility(doc._id);
                  setMenuOpen(false);
                }}
                className={styles.menuItem}
              >
                {doc.visible ? '👁️ Nascondi' : '👁️‍🗨️ Mostra'}
              </button>
              <button
                onClick={() => {
                  onToggleDraft(doc._id);
                  setMenuOpen(false);
                }}
                className={styles.menuItem}
              >
                {doc.isDraft ? '✓ Pubblica' : '📋 Segna Bozza'}
              </button>
              <button
                onClick={() => {
                  onDelete(doc._id);
                  setMenuOpen(false);
                }}
                className={classNames(styles.menuItem, styles.danger)}
              >
                🗑️ Elimina Documento
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children rendering is handled by SortableDocumentNode wrapper */}
    </div>
  );
});

DocumentNode.displayName = 'DocumentNode';
