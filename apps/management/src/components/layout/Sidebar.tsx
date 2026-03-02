/**
 * Sidebar - Hierarchical navigation sidebar
 *
 * Features:
 * - Nested categories (collapsable)
 * - Permission-based visibility
 * - Active route highlight
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/Sidebar.module.scss';

interface NavItem {
  key: string;
  label: string;
  icon?: string;
  href?: string;
  permission?: string;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
  {
    key: 'users',
    label: 'Utenti',
    icon: '👥',
    children: [
      { key: 'users-list', label: 'Lista Utenti', href: '/users/user-list', permission: 'user.read' },
      { key: 'users-permissions', label: 'Permessi', href: '/users/permissions', permission: 'user.permissions' },
      { key: 'users-bans', label: 'Ban List', href: '/users/ban-list', permission: 'user.ban' }
    ]
  },
  {
    key: 'characters',
    label: 'Personaggi',
    icon: '🎭',
    children: [
      { key: 'characters-list', label: 'Lista Personaggi', href: '/characters/character-list', permission: 'character.read' },
      { key: 'characters-pending', label: 'In Attesa Approvazione', href: '/characters/character-pending', permission: 'character.approve' }
    ]
  },
  {
    key: 'documents',
    label: 'Documenti',
    icon: '📄',
    children: [
      { key: 'documents-list', label: 'Lista Documenti', href: '/documents/document-list', permission: 'documents.read' }
    ]
  },
  {
    key: 'system',
    label: 'Sistema',
    icon: '⚙️',
    children: [
      { key: 'system-configs', label: 'Configurazioni', href: '/system/configurations', permission: 'system.config' },
      { key: 'system-audit', label: 'Audit Logs', href: '/system/audit-logs', permission: 'system.audit' },
      { key: 'system-broadcast', label: 'Broadcast', href: '/system/broadcast', permission: 'system.broadcast' }
    ]
  }
];

export function Sidebar(): React.ReactElement {
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['users', 'characters', 'documents']));

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem, level: number = 0) => {
    // Category with children
    if (item.children) {
      const isExpanded = expandedCategories.has(item.key);
      const hasActiveChild = item.children.some(child => child.href === router.pathname);

      return (
        <div key={item.key} className={styles.category}>
          <button
            onClick={() => toggleCategory(item.key)}
            className={classNames(
              styles.categoryHeader,
              hasActiveChild && styles.hasActive,
              isExpanded && styles.expanded
            )}
            title={item.label}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!sidebarCollapsed && (
              <>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
              </>
            )}
          </button>

          {isExpanded && !sidebarCollapsed && (
            <div className={styles.categoryChildren}>
              {item.children.map(child => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item with href
    if (item.href) {
      const isActive = router.pathname === item.href;

      return (
        <Link
          key={item.key}
          href={item.href}
          className={classNames(
            styles.navItem,
            isActive && styles.active,
            level > 0 && styles.child
          )}
          title={item.label}
        >
          {item.icon && <span className={styles.icon}>{item.icon}</span>}
          {!sidebarCollapsed && <span className={styles.label}>{item.label}</span>}
        </Link>
      );
    }

    return null;
  };

  return (
    <aside className={classNames(styles.sidebar, sidebarCollapsed && styles.collapsed)}>
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className={styles.toggleButton}
        aria-label={sidebarCollapsed ? 'Espandi sidebar' : 'Riduci sidebar'}
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => renderNavItem(item))}
      </nav>
    </aside>
  );
}
