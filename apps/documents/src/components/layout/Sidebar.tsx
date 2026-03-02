/**
 * Sidebar Component (NEW MULTI-TYPE HIERARCHICAL)
 *
 * Desktop sidebar showing ALL document types with full hierarchical navigation.
 * Each type is collapsible with nested route trees.
 *
 * @module components/layout/Sidebar
 * @since 1.0.0
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAllRoutes } from '@/hooks/useAllRoutes';
import { RouteTreeView } from '../navigation/RouteTreeView';
import { DOCUMENT_TYPE_CONFIGS, DOCUMENT_TYPE_ORDER } from '@/types/document';
import styles from '@/styles/components/layout/Sidebar.module.scss';

export function Sidebar(): JSX.Element {
  const router = useRouter();
  const { data: routesByType, isLoading } = useAllRoutes();

  // Track which type sections are collapsed
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

  // Determine current path for active state highlighting
  const currentPath = router.asPath;

  // Determine which types to show based on current section
  // Regolamento section: show only Regolamento
  // Ambientazione/Approfondimenti section: show both Ambientazione and Approfondimenti
  const isOnRegolamento = currentPath.startsWith('/regolamento');
  const typesToShow = isOnRegolamento
    ? ['regolamento']
    : ['ambientazione', 'approfondimenti'];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>  
        <div className={styles.treeContainer}>
          {DOCUMENT_TYPE_ORDER.filter(type => typesToShow.includes(type)).map((type) => {
            const config = DOCUMENT_TYPE_CONFIGS[type];
            const routes = routesByType?.[type] || [];
            const isCollapsed = collapsedTypes.has(type);
            const isCurrentType = currentPath.startsWith(`/${type}`);

            return (
              <div key={type} className={styles.typeSection}>
                {/* Type Header (collapsible) */}
                <button
                  className={`${styles.typeHeader} ${isCurrentType ? styles.active : ''}`}
                  onClick={() => toggleType(type)}
                >
                  <span className={styles.typeIcon}>{isCollapsed ? '▶' : '▼'}</span>
                  <span className={styles.typeEmoji}>{config.icon}</span>
                  <span className={styles.typeLabel}>{config.label}</span>
                  <span className={styles.typeCount}>({routes.length})</span>
                </button>

                {/* Hierarchical Route Tree */}
                {!isCollapsed && (
                  <div className={styles.typeContent}>
                    {routes.length === 0 ? (
                      <p className={styles.emptyMessage}>Nessun documento disponibile</p>
                    ) : (
                      <RouteTreeView
                        routes={routes}
                        type={type}
                        currentPath={currentPath}
                        depth={0}
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
