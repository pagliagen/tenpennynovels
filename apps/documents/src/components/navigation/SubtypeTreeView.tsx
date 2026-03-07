/**
 * SubtypeTreeView Component
 *
 * Renders subtypes with hierarchical document tree navigation.
 * Replicates the management app's DocumentNode tree structure:
 * - Documents with children: toggleable (expand/collapse), not navigable
 * - Documents without children: navigable links
 * - Icons, badges, indentation matching management tree
 *
 * @module components/navigation/SubtypeTreeView
 * @since 2.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { DocumentSubtype, SubtypeDocument } from '@/types/document';
import styles from './RouteTreeView.module.scss';

interface SubtypeTreeViewProps {
  subtypes: DocumentSubtype[];
  type: string;
  currentPath: string;
}

export function SubtypeTreeView({ subtypes, type, currentPath }: SubtypeTreeViewProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const docContainsActivePath = useCallback((doc: SubtypeDocument): boolean => {
    const docPath = `/${type}/${doc.path}`;
    if (currentPath === docPath || currentPath.startsWith(`${docPath}/`)) return true;
    return doc.children?.some(child => docContainsActivePath(child)) ?? false;
  }, [type, currentPath]);

  useEffect(() => {
    const toExpand = new Set<string>();

    const walk = (docs: SubtypeDocument[]) => {
      docs.forEach(doc => {
        if (doc.children && doc.children.length > 0 && docContainsActivePath(doc)) {
          toExpand.add(doc._id);
          walk(doc.children);
        }
      });
    };

    subtypes.forEach(s => walk(s.documents || []));
    setExpandedDocs(toExpand);
  }, [currentPath, subtypes, docContainsActivePath]);

  const toggleDoc = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const renderDocNode = (doc: SubtypeDocument, depth: number) => {
    const hasChildren = doc.children && doc.children.length > 0;
    const isExpanded = expandedDocs.has(doc._id);
    const docPath = `/${type}/${doc.path}`;
    const isActive = currentPath === docPath || currentPath.startsWith(`${docPath}/`);

    return (
      <div key={doc._id}>
        <div
          className={styles.documentNode}
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          <div className={styles.documentRow}> 
            {hasChildren ? (
              <button
                type="button"
                className={`${styles.docToggle} ${isExpanded ? styles.expanded : ''}`}
                onClick={() => toggleDoc(doc._id)}
              >
                <span className={styles.docTitle}>{doc.title}</span>
                {!doc.isPublic && <span className={styles.privateBadge}>🔒</span>}
              </button>
            ) : (
              <Link
                href={docPath}
                className={`${styles.docLink} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.docTitle}>{doc.title}</span>
                {!doc.isPublic && <span className={styles.privateBadge}>🔒</span>}
              </Link>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.children}>
            {doc.children!.map(child => renderDocNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.routeTree}>
      {subtypes.map((subtype) => {
        const docs = subtype.documents || [];

        return (
          <div key={subtype._id} className={styles.subtypeGroup}>
            <div className={styles.subtypeLabel}>{subtype.title}</div>

            {docs.map(doc => renderDocNode(doc, 0))}
          </div>
        );
      })}
    </div>
  );
}
