/**
 * RouteTreeSelector - Shows existing routes in tree format for parent selection
 * Used when creating a route for an existing document
 */

import React, { useState } from 'react';
import classNames from 'classnames';
import styles from './RouteTreeSelector.module.scss';
import type { Route } from '@/types/api/Document';

interface RouteTreeSelectorProps {
  routes: Route[];
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  onSelectRoute: (routeId: string) => void;
  onCreateRootRoute: () => void;
}

export function RouteTreeSelector({
  routes,
  type,
  onSelectRoute,
  onCreateRootRoute
}: RouteTreeSelectorProps) {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  const toggleExpand = (routeId: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const renderRoute = (route: Route, depth: number = 0): React.ReactNode => {
    const hasChildren = route.children && route.children.length > 0;
    const isExpanded = expandedRoutes.has(route._id);

    return (
      <div key={route._id} className={styles.routeItem}>
        <div
          className={styles.routeRow}
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(route._id)}
              className={styles.expandButton}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className={styles.expandPlaceholder}></span>}

          <span className={styles.routeIcon}>
            {depth === 0 ? '📁' : '📄'}
          </span>

          <div className={styles.routeInfo}>
            <span className={styles.routePath}>{route.path}</span>
            <span className={styles.routeTitle}>{route.title}</span>
            {!route.enabled && <span className={styles.badge}>Nascosto</span>}
          </div>

          <button
            className={styles.addButton}
            onClick={() => onSelectRoute(route._id)}
            title="Aggiungi come child di questa route"
          >
            +
          </button>
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className={styles.childRoutes}>
            {route.children!.map(child => renderRoute(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.routeTreeSelector}>
      <div className={styles.header}>
        <h3>Seleziona route parent</h3>
        <p className={styles.description}>
          Scegli dove aggiungere la nuova route, oppure crea una route di primo livello.
        </p>
      </div>

      {/* Root route button */}
      <button
        className={styles.createRootButton}
        onClick={onCreateRootRoute}
      >
        + Crea Rotta di Primo Livello ({type})
      </button>

      {/* Existing routes tree */}
      {routes.length > 0 ? (
        <div className={styles.routeTree}>
          {routes.map(route => renderRoute(route, 0))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          Nessuna route esistente per "{type}". Crea una route di primo livello.
        </div>
      )}
    </div>
  );
}
