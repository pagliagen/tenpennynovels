/**
 * Sidebar Component (Subtype-based Navigation)
 *
 * Desktop sidebar showing documents grouped by subtype.
 * Each subtype is a collapsible section with its document links.
 *
 * @module components/layout/Sidebar
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useDocumentTree } from '@/hooks/useDocumentTree';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';
import { DOCUMENT_TYPE_CONFIGS, DOCUMENT_TYPE_ORDER } from '@/types/document';
import styles from '@/styles/components/layout/Sidebar.module.scss';

export function Sidebar(): JSX.Element {
  const router = useRouter();
  const { data: documentsByType } = useDocumentTree();

  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const toggleType = (type: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const currentPath = router.asPath;

  const isOnRegolamento = currentPath.startsWith('/regolamento');
  const typesToShow = isOnRegolamento ? ['regolamento'] : ['ambientazione'];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <div className={styles.treeContainer}>
          {DOCUMENT_TYPE_ORDER.filter(type => typesToShow.includes(type)).map((type) => {
            const config = DOCUMENT_TYPE_CONFIGS[type];
            const subtypes = documentsByType?.[type] || [];
            const isCollapsed = collapsedTypes.has(type);
            const isCurrentType = currentPath.startsWith(`/${type}`);

            const totalDocs = subtypes.reduce((sum, st) => sum + (st.documents?.length || 0), 0);

            return (
              <div key={type} className={styles.typeSection}>
                <button
                  className={`${styles.typeHeader} ${isCurrentType ? styles.active : ''}`}
                  onClick={() => toggleType(type)}
                >
                  <span className={styles.typeIcon}>{isCollapsed ? '▶' : '▼'}</span>
                  <span className={styles.typeEmoji}>{config.icon}</span>
                  <span className={styles.typeLabel}>{config.label}</span>
                  <span className={styles.typeCount}>({totalDocs})</span>
                </button>

                {!isCollapsed && (
                  <div className={styles.typeContent}>
                    {subtypes.length === 0 ? (
                      <p className={styles.emptyMessage}>Nessun documento disponibile</p>
                    ) : (
                      <SubtypeTreeView
                        subtypes={subtypes}
                        type={type}
                        currentPath={currentPath}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
