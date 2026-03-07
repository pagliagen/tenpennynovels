/**
 * SubtypeTreeView Component
 *
 * Renders subtypes with document links, always expanded.
 * Each subtype is a header, documents are direct children (max 2 levels).
 *
 * @module components/navigation/SubtypeTreeView
 * @since 2.0.0
 */

import Link from 'next/link';
import type { DocumentSubtype } from '@/types/document';
import styles from './RouteTreeView.module.scss';

interface SubtypeTreeViewProps {
  subtypes: DocumentSubtype[];
  type: string;
  currentPath: string;
}

export function SubtypeTreeView({ subtypes, type, currentPath }: SubtypeTreeViewProps) {
  return (
    <div className={styles.routeTree}>
      {subtypes.map((subtype) => {
        const docs = subtype.documents || [];

        return (
          <div key={subtype._id} className={styles.routeItem}>
            <div className={styles.routeRow}>
              <span className={styles.subtypeLabel}>
                <span className={styles.routeTitle}>{subtype.title}</span>
              </span>
            </div>

            {docs.length > 0 && (
              <div className={styles.routeChildren}>
                {docs.map((doc) => {
                  const docPath = `/${type}/${doc.path}`;
                  const isActive = currentPath === docPath;

                  return (
                    <div
                      key={doc._id}
                      className={`${styles.routeItem} ${styles.childItem}`}
                    >
                      <div className={styles.routeRow}>
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
