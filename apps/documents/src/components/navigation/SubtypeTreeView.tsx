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

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import type { DocumentSubtype, SubtypeDocument } from '@/types/document';
import styles from './RouteTreeView.module.scss';

const STORAGE_KEY_PREFIX = 'sidebar-expanded';

function loadFromStorage(type: string, key: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${type}:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(type: string, key: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}:${type}:${key}`, JSON.stringify([...ids]));
  } catch { /* quota exceeded, ignore */ }
}

interface SubtypeTreeViewProps {
  subtypes: DocumentSubtype[];
  type: string;
  currentPath: string;
}

export function SubtypeTreeView({ subtypes, type, currentPath }: SubtypeTreeViewProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(() => {
    const saved = loadFromStorage(type, 'docs');
    return saved ? new Set(saved) : new Set();
  });
  const [expandedSubtypes, setExpandedSubtypes] = useState<Set<string>>(() => {
    const saved = loadFromStorage(type, 'subtypes');
    if (saved) return new Set(saved);
    return new Set(subtypes.filter(s => s.expandedByDefault).map(s => s._id));
  });
  const isInitialMount = useRef(true);

  const docContainsActivePath = useCallback((doc: SubtypeDocument): boolean => {
    const docPath = `/${type}/${doc.path}`;
    if (currentPath === docPath || currentPath.startsWith(`${docPath}/`)) return true;
    return doc.children?.some(child => docContainsActivePath(child)) ?? false;
  }, [type, currentPath]);

  const subtypeContainsActivePath = useCallback((subtype: DocumentSubtype): boolean => {
    return (subtype.documents || []).some(doc => docContainsActivePath(doc));
  }, [docContainsActivePath]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }

    setExpandedDocs(prev => {
      const next = new Set(prev);
      subtypes.forEach(s => {
        const walk = (docs: SubtypeDocument[]) => {
          docs.forEach(doc => {
            if (doc.children && doc.children.length > 0 && docContainsActivePath(doc)) {
              next.add(doc._id);
              walk(doc.children);
            }
          });
        };
        walk(s.documents || []);
      });
      return next;
    });

    setExpandedSubtypes(prev => {
      const next = new Set(prev);
      subtypes.forEach(s => {
        if (subtypeContainsActivePath(s)) {
          next.add(s._id);
        }
      });
      return next;
    });
  }, [currentPath, subtypes, docContainsActivePath, subtypeContainsActivePath]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage(type, 'docs', expandedDocs);
  }, [expandedDocs, type]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage(type, 'subtypes', expandedSubtypes);
  }, [expandedSubtypes, type]);

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
          style={{ '--depth': depth } as CSSProperties}
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
                <span className={styles.docTitle} title={doc.title}>{doc.title}</span>
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
