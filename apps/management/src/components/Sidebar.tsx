// =============================================================================
// Sidebar Component 
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthContext, Character } from '@/lib/auth';
import { CharacterSwitcher } from './CharacterSwitcher';
import styles from '@/styles/components/Sidebar.module.scss';

interface SidebarProps {
  authContext: AuthContext;
}

export function Sidebar({ authContext }: SidebarProps) {
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Initialize selected character from localStorage or context
  useEffect(() => {
    if (authContext.availableCharacters && authContext.availableCharacters.length > 0) {
      // Try to get from localStorage first
      const storedCharacterId = localStorage.getItem('selectedCharacterId');
      
      if (storedCharacterId) {
        // Find the character in available characters
        const storedCharacter = authContext.availableCharacters.find(
          char => char.id === storedCharacterId
        );
        
        if (storedCharacter) {
          setSelectedCharacter(storedCharacter);
          return;
        }
      }
      
      // Fallback to context character or first available
      const defaultCharacter = authContext.character || authContext.availableCharacters[0];
      setSelectedCharacter(defaultCharacter);
      
      // Store the default selection in localStorage
      if (defaultCharacter) {
        localStorage.setItem('selectedCharacterId', defaultCharacter.id);
      }
    }
  }, [authContext.availableCharacters, authContext.character]);

  // Handle character change
  const handleCharacterChange = (character: Character) => {
    setSelectedCharacter(character);
    localStorage.setItem('selectedCharacterId', character.id);
    
    // Trigger a page reload to fetch new data for the selected character
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('characterId', character.id);
    window.location.href = currentUrl.toString();
  };

  // Get the character to display (selected or fallback)
  const displayCharacter = selectedCharacter || authContext.character;

  // Toggle menu expansion
  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  // Navigate to route
  const navigateTo = (path: string) => {
    router.push(path);
  };

  // Check if current route is active
  const isActiveRoute = (path: string) => {
    const currentPath = router.pathname;

    // Exact match
    if (currentPath === path) return true;

    // Handle dynamic routes - extract base path
    const basePath = path.split('/[')[0];

    // Check if current path starts with the base path
    if (basePath !== path && currentPath.startsWith(basePath + '/')) {
      return true;
    }

    return false;
  };

  // Get visible menu structure from auth context
  const visibleMenu = authContext.user?.visibleMenu || {};

  /**
   * Check if user has permission to access a specific resource
   * This adds an additional client-side verification layer on top of backend filtering
   */
  const hasPermission = (permission: string): boolean => {
    // USER.GESTORE has always access to everything
    if (authContext.user?.userRoles?.includes('gestore')) {
      return true;
    }

    // Parse permission format: "section.access" or "section.detail.action"
    const parts = permission.split('.');

    // For simple access permission (e.g., "dashboard.access")
    if (parts.length === 2 && parts[1] === 'access') {
      const section = parts[0];
      return authContext.user?.effectivePermissions?.[section]?.access === true;
    }

    // For detail permission (e.g., "users.detail.read")
    if (parts.length === 3 && parts[1] === 'detail') {
      const section = parts[0];
      const action = parts[2];
      return (
        authContext.user?.effectivePermissions?.[section]?.access === true &&
        authContext.user?.effectivePermissions?.[section]?.detail?.[action] === true
      );
    }

    // For special manager permissions (e.g., "manager.manage_user_permissions")
    if (parts[0] === 'manager') {
      return authContext.user?.userRoles?.includes('gestore') || false;
    }

    // Fallback: check if permission exists in characterPermissions array
    return authContext.user?.characterPermissions?.includes(permission) || false;
  };

  /**
   * Filter menu items based on user permissions
   * Backend already filters, but we add client-side verification for security
   */
  const filterMenuItems = (menu: any): any => {
    const filteredMenu: any = {};

    for (const [menuId, menuConfig] of Object.entries(menu)) {
      const config = menuConfig as any;

      // Verify user has permission for this menu item
      if (!hasPermission(config.permission)) {
        continue; // Skip this menu item
      }

      // Add menu item to filtered structure
      filteredMenu[menuId] = {
        icon: config.icon,
        label: config.label,
        permission: config.permission
      };

      // Filter submenu children if they exist
      if (config.children && Array.isArray(config.children)) {
        const visibleChildren = config.children.filter((child: any) =>
          hasPermission(child.permission)
        );

        // Only include children if there are visible items
        if (visibleChildren.length > 0) {
          filteredMenu[menuId].children = visibleChildren;
        }
      }
    }

    return filteredMenu;
  };

  // Apply permission filtering to visible menu
  const secureMenu = filterMenuItems(visibleMenu);

  /**
   * Find parent menu IDs that contain the current route
   */
  const findParentMenusForRoute = (pathname: string): string[] => {
    const parentMenus: string[] = [];

    for (const [menuId, menuConfig] of Object.entries(secureMenu)) {
      const config = menuConfig as any;

      if (!config.children || !Array.isArray(config.children)) {
        continue;
      }

      const hasMatchingChild = config.children.some((child: any) => {
        if (!child.url) return false;

        // Exact match
        if (child.url === pathname) return true;

        // Handle dynamic routes (e.g., /corporations/[id])
        const baseUrl = child.url.split('/[')[0];
        if (pathname.startsWith(baseUrl + '/') || pathname === baseUrl) {
          return true;
        }

        return false;
      });

      if (hasMatchingChild) {
        parentMenus.push(menuId);
      }
    }

    return parentMenus;
  };

  /**
   * Automatically expand parent menus based on current route
   * Runs on initial mount and whenever route changes
   */
  useEffect(() => {
    const currentPath = router.pathname;

    // Find which parent menus should be expanded for this route
    const parentMenusToExpand = findParentMenusForRoute(currentPath);

    if (parentMenusToExpand.length > 0) {
      setExpandedMenus(prev => {
        const newExpandedState = { ...prev };

        // Expand all parent menus that contain the current route
        parentMenusToExpand.forEach(menuId => {
          newExpandedState[menuId] = true;
        });

        return newExpandedState;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚔️</span>
          <span className={styles.logoText}>
            <span className={styles.logoMain}>TenpennyNovels</span>
            <span className={styles.logoSub}>Management</span>
          </span>
        </div>
      </div>

      {/* Character Info */}
      <div className={styles.userInfo}>
        <div className={styles.userAvatar}>
          <img
            src={displayCharacter?.avatarUrl || authContext.user?.avatarUrl}
            alt="Character Avatar"
          />
        </div>
        <div className={styles.userDetails}>
          <div className={styles.characterName}>
            {displayCharacter ?
              `${displayCharacter.name}${displayCharacter.surname ? ` ${displayCharacter.surname}` : ''}` :
              `${authContext.user?.firstName} ${authContext.user?.lastName}`
            }
            {authContext.availableCharacters && authContext.availableCharacters.length > 1 && (
              <CharacterSwitcher
                currentCharacter={displayCharacter}
                availableCharacters={authContext.availableCharacters}
                onCharacterChange={handleCharacterChange}
              />
            )}
          </div>
          <div className={styles.userRole}>
            {authContext.user?.userRoles?.includes('gestore') ? 'Gestore' :
             displayCharacter?.gameplayRoles?.includes('amministratore') ? 'Amministratore' :
             displayCharacter?.gameplayRoles?.includes('master') ? 'Master' :
             displayCharacter?.gameplayRoles?.includes('moderatore') ? 'Moderatore' :
             'Personaggio'}
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className={styles.navigation}>
        <ul className={styles.menuList}>
          {Object.entries(secureMenu).map(([menuId, menuConfig]: [string, any]) => (
            <li key={menuId} className={styles.menuItem}>
              <button
                className={`${styles.menuButton} ${
                  isActiveRoute(`/${menuId}`) ? styles.active : ''
                } ${menuConfig.children ? styles.hasChildren : ''}`}
                onClick={() => {
                  if (menuConfig.children) {
                    toggleMenu(menuId);
                  } else {
                    navigateTo(menuId === 'dashboard' ? '/' : `/${menuId}`);
                  }
                }}
              >
                <span className={styles.menuIcon}>{menuConfig.icon}</span>
                <span className={styles.menuLabel}>{menuConfig.label}</span>
                {menuConfig.children && (
                  <span className={`${styles.expandIcon} ${
                    expandedMenus[menuId] ? styles.expanded : ''
                  }`}>
                    ▼
                  </span>
                )}
              </button>

              {/* Submenu */}
              {menuConfig.children && (
                <ul className={`${styles.submenu} ${
                  expandedMenus[menuId] ? styles.expanded : ''
                }`}>
                  {menuConfig.children.map((child: any, index: number) => (
                    <li key={index} className={styles.submenuItem}>
                      <button
                        className={`${styles.submenuButton} ${
                          isActiveRoute(child.url || `/${menuId}/${child.label.toLowerCase().replace(/\s+/g, '-')}`) ? styles.active : ''
                        }`}
                        onClick={() => navigateTo(child.url || `/${menuId}/${child.label.toLowerCase().replace(/\s+/g, '-')}`)}
                      >
                        <span className={styles.submenuIcon}>{child.icon}</span>
                        <span className={styles.submenuLabel}>{child.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

    </aside>
  );
}