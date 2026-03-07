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
  const [expandedSubtypes, setExpandedSubtypes] = useState<Set<string>>(new Set());

  const docContainsActivePath = useCallback((doc: SubtypeDocument): boolean => {
    const docPath = `/${type}/${doc.path}`;
    if (currentPath === docPath || currentPath.startsWith(`${docPath}/`)) return true;
    return doc.children?.some(child => docContainsActivePath(child)) ?? false;
  }, [type, currentPath]);

  const subtypeContainsActivePath = useCallback((subtype: DocumentSubtype): boolean => {
    return (subtype.documents || []).some(doc => docContainsActivePath(doc));
  }, [docContainsActivePath]);

  useEffect(() => {
    const docsToExpand = new Set<string>();
    const subtypesToExpand = new Set<string>();

    subtypes.forEach(s => {
      if (subtypeContainsActivePath(s)) {
        subtypesToExpand.add(s._id);
      }

      const walk = (docs: SubtypeDocument[]) => {
        docs.forEach(doc => {
          if (doc.children && doc.children.length > 0 && docContainsActivePath(doc)) {
            docsToExpand.add(doc._id);
            walk(doc.children);
          }
        });
      };
      walk(s.documents || []);
    });

    setExpandedDocs(docsToExpand);
    setExpandedSubtypes(subtypesToExpand);
  }, [currentPath, subtypes, docContainsActivePath, subtypeContainsActivePath]);

  const toggle = (id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
                onClick={() => toggle(doc._id, setExpandedDocs)}
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

        const isSubtypeExpanded = expandedSubtypes.has(subtype._id);

        return (
          <div key={subtype._id} className={styles.subtypeGroup}>
            <button
              type="button"
              className={`${styles.subtypeLabel} ${isSubtypeExpanded ? styles.expanded : ''}`}
              onClick={() => toggle(subtype._id, setExpandedSubtypes)}
            >
              {subtype.title}
            </button>

            {isSubtypeExpanded && docs.map(doc => renderDocNode(doc, 0))}
          </div>
        );
      })}
    </div>
  );
}
