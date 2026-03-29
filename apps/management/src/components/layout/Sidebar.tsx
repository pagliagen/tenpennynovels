/**
 * Sidebar - Hierarchical navigation sidebar
 *
 * Features:
 * - Nested categories (collapsable)
 * - Permission-based visibility
 * - Active route highlight
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import { useUIStore } from '@/store/uiStore';
import { usePermissionsStore } from '@/store/permissionsStore';
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
      { key: 'users-list', label: 'Lista Utenti', href: '/users/user-list', permission: 'users.list' },
      { key: 'users-bans', label: 'Ban List', href: '/users/ban-list', permission: 'users.ban' }
    ]
  },
  {
    key: 'characters',
    label: 'Personaggi',
    icon: '🎭',
    children: [
      { key: 'characters-list', label: 'Lista Personaggi', href: '/characters/character-list', permission: 'characters.list' },
      { key: 'characters-pending', label: 'In Attesa Approvazione', href: '/characters/character-pending', permission: 'characters.approve' },
      { key: 'characters-faceclaims', label: 'Prestavolti', href: '/characters/character-faceclaims', permission: 'characters.approve' },
      { key: 'characters-permissions', label: 'Permessi', href: '/characters/permissions', permission: 'characters.manage_permissions' }
    ]
  },
  {
    key: 'locations',
    label: 'Location',
    icon: '🗺️',
    children: [
      { key: 'locations-list', label: 'Gestione Location', href: '/locations/location-list', permission: 'locations.list' }
    ]
  },
  {
    key: 'documents',
    label: 'Documenti',
    icon: '📄',
    children: [
      { key: 'documents-list', label: 'Lista Documenti', href: '/documents/document-list', permission: 'documents.list' },
      { key: 'documents-subtypes', label: 'Sottotipi', href: '/documents/subtypes', permission: 'documents.list' },
      { key: 'documents-seo', label: 'SEO Documenti', href: '/documents/seo-documents', permission: 'documents.list' }
    ]
  },
  {
    key: 'game-data',
    label: 'Dati di Gioco',
    icon: '🎲',
    children: [
      { key: 'game-skills', label: 'Skills', href: '/game-data/skill-list', permission: 'skills.access' },
      { key: 'game-social-classes', label: 'Classi Sociali', href: '/game-data/social-class-list', permission: 'social_classes.access' },
      { key: 'game-occupations', label: 'Occupazioni', href: '/game-data/occupation-list', permission: 'skills.access' },
      { key: 'game-items', label: 'Mercato', href: '/game-data/item-list', permission: 'items.access' },
      { key: 'game-forum-topics', label: 'Forum - Argomenti', href: '/game-data/forum-topics', permission: 'forum.manage' }
    ]
  },
  {
    key: 'messages',
    label: 'Messaggi',
    icon: '✉️',
    children: [
      { key: 'messages-ongame', label: 'Posta OnGame', href: '/messages/ongame', permission: 'messaging.moderation.manage' },
      { key: 'messages-offgame', label: 'Chat OffGame', href: '/messages/offgame', permission: 'messaging.moderation.manage' }
    ]
  },
  {
    key: 'moderation',
    label: 'Moderazione',
    icon: '🛡️',
    children: [
      { key: 'chat-moderation', label: 'Moderazione Chat AI', href: '/moderation/chat-moderation', permission: 'moderation.chat_ai' },
      { key: 'forum-moderation', label: 'Moderazione Forum AI', href: '/moderation/forum-moderation', permission: 'moderation.forum_ai' }
    ]
  },
  {
    key: 'system',
    label: 'Sistema',
    icon: '⚙️',
    children: [
      { key: 'system-configs', label: 'Configurazioni', href: '/system/configurations', permission: 'system.config' },
      { key: 'system-audit', label: 'Audit Logs', href: '/system/audit-logs', permission: 'system.logs' },
      { key: 'system-broadcast', label: 'Broadcast', href: '/system/broadcast', permission: 'system.broadcast' },
      { key: 'system-deleted', label: 'Record Cancellati', href: '/system/deleted-records', permission: 'system.deleted_records' }
    ]
  },
  {
    key: 'tickets',
    label: 'Supporto',
    icon: '🎫',
    children: [
      { key: 'tickets-dashboard', label: 'Dashboard', href: '/tickets/dashboard', permission: 'tickets.manage' },
      { key: 'tickets-list', label: 'Tutti i Ticket', href: '/tickets/ticket-list', permission: 'tickets.manage' },
      { key: 'tickets-character-approvals', label: 'Approvazioni Personaggio', href: '/tickets/character-approvals', permission: 'tickets.manage' }
    ]
  }
];

export function Sidebar(): React.ReactElement {
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, expandedCategories, toggleCategory } = useUIStore();
  const { hasPermission } = usePermissionsStore();

  const renderNavItem = (item: NavItem, level: number = 0) => {
    // Category with children
    if (item.children) {
      // Filter visible children based on permissions
      const visibleChildren = item.children.filter(child => {
        // No permission required = always visible
        if (!child.permission) return true;
        // Check permission
        return hasPermission(child.permission);
      });

      // Hide category if all children are hidden
      if (visibleChildren.length === 0) {
        return null;
      }

      const isExpanded = expandedCategories.includes(item.key);
      const hasActiveChild = visibleChildren.some(child => child.href === router.pathname);

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
              {visibleChildren.map(child => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item with href
    if (item.href) {
      // Hide if no permission
      if (item.permission && !hasPermission(item.permission)) {
        return null;
      }

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
