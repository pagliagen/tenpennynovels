/**
 * SubtypeTreeView Component
 *
 * Renders subtypes as collapsible groups with document links.
 * Each subtype is a header, documents are direct children (max 2 levels).
 *
 * @module components/navigation/SubtypeTreeView
 * @since 2.0.0
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DocumentSubtype } from '@/types/document';
import styles from './RouteTreeView.module.scss';

interface SubtypeTreeViewProps {
  subtypes: DocumentSubtype[];
  type: string;
  currentPath: string;
}

export function SubtypeTreeView({ subtypes, type, currentPath }: SubtypeTreeViewProps) {
  const [expandedSubtypes, setExpandedSubtypes] = useState<Set<string>>(new Set());

  // Auto-expand subtypes that contain the active document
  useEffect(() => {
    const toExpand = new Set<string>();

    subtypes.forEach(subtype => {
      const hasActive = subtype.documents?.some(doc => {
        const docPath = `/${type}/${doc.path}`;
        return currentPath === docPath || currentPath.startsWith(`${docPath}/`);
      });

      if (hasActive) {
        toExpand.add(subtype._id);
      }
    });

    setExpandedSubtypes(toExpand);
  }, [currentPath, subtypes, type]);

  const toggleSubtype = (subtypeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpandedSubtypes((prev) => {
      const next = new Set(prev);
      if (next.has(subtypeId)) {
        next.delete(subtypeId);
      } else {
        next.add(subtypeId);
      }
      return next;
    });
  };

  return (
    <div className={styles.routeTree}>
      {subtypes.map((subtype) => {
        const isExpanded = expandedSubtypes.has(subtype._id);
        const docs = subtype.documents || [];
        const hasDocuments = docs.length > 0;

        return (
          <div key={subtype._id} className={styles.routeItem}>
            <div className={styles.routeRow}>
              {hasDocuments && (
                <button
                  className={styles.expandButton}
                  onClick={(e) => toggleSubtype(subtype._id, e)}
                  aria-label={isExpanded ? 'Comprimi' : 'Espandi'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!hasDocuments && <span className={styles.expandPlaceholder} />}

              <span className={styles.routeLink} style={{ fontWeight: 600 }}>
                <span className={styles.routeTitle}>{subtype.title}</span>
              </span>
            </div>

            {hasDocuments && isExpanded && (
              <div className={styles.routeChildren}>
                {docs.map((doc) => {
                  const docPath = `/${type}/${doc.path}`;
                  const isActive = currentPath === docPath;

                  return (
                    <div
                      key={doc._id}
                      className={styles.routeItem}
                      style={{ paddingLeft: '16px' }}
                    >
                      <div className={styles.routeRow}>
                        <span className={styles.expandPlaceholder} />
                        <Link
                          href={docPath}
                          className={`${styles.routeLink} ${isActive ? styles.active : ''}`}
                        >
                          <span className={styles.routeTitle}>{doc.title}</span>
                          {!doc.isPublic && <span className={styles.privateBadge}>🔒</span>}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
