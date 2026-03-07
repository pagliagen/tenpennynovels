/**
 * RouteTreeView Component
 *
 * Recursive component for rendering hierarchical route navigation.
 * Supports unlimited nesting depth with expand/collapse functionality.
 *
 * @module components/navigation/RouteTreeView
 * @since 1.0.0
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './RouteTreeView.module.scss';

interface RouteTreeViewProps {
  routes: any[];
  type: string;
  currentPath: string;
  depth: number;
}

export function RouteTreeView({ routes, type, currentPath, depth }: RouteTreeViewProps) {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  // Helper: Check if a route or any of its descendants contains the active path
  const routeContainsActivePath = (route: any): boolean => {
    const routePath = `/${type}/${route.path}`;
    if (currentPath === routePath || currentPath.startsWith(`${routePath}/`)) {
      return true;
    }
    if (route.children && route.children.length > 0) {
      return route.children.some((child: any) => routeContainsActivePath(child));
    }
    return false;
  };

  // Auto-expand routes that contain the active path
  useEffect(() => {
    const routesToExpand = new Set<string>();

    const findAndExpandActiveRoutes = (routeList: any[]) => {
      routeList.forEach((route) => {
        if (route.children && route.children.length > 0) {
          if (routeContainsActivePath(route)) {
            routesToExpand.add(route._id);
            findAndExpandActiveRoutes(route.children);
          }
        }
      });
    };

    findAndExpandActiveRoutes(routes);
    setExpandedRoutes(routesToExpand);
  }, [currentPath, routes, type]);

  const toggleRoute = (routeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const renderRoute = (route: any, currentDepth: number): React.ReactNode => {
    const hasChildren = route.children && route.children.length > 0;
    const isExpanded = expandedRoutes.has(route._id);
    const routePath = `/${type}/${route.path}`;
    const isActive = currentPath === routePath || currentPath.startsWith(`${routePath}/`);

    return (
      <div
        key={route._id}
        className={styles.routeItem}
        style={{ '--depth': currentDepth } as React.CSSProperties}
      >
        <div className={styles.routeRow}>
          {/* Expand button (if has children) */}
          {hasChildren && (
            <button
              className={styles.expandButton}
              onClick={(e) => toggleRoute(route._id, e)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {/* Route link */}
          <Link
            href={routePath}
            className={`${styles.routeLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.routeTitle}>{route.title}</span>
            {!route.isPublic && <span className={styles.privateBadge}>🔒</span>}
          </Link>
        </div>

        {/* Recursive children */}
        {hasChildren && isExpanded && (
          <div className={styles.routeChildren}>
            {route.children.map((child: any) => renderRoute(child, currentDepth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.routeTree}>
      {routes.map((route) => renderRoute(route, depth))}
    </div>
  );
}
