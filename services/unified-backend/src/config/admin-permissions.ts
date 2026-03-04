/**
 * Admin Panel Permissions System
 *
 * Flat permission system for admin panel access control.
 * Format: section.action (2 parts, type-safe enum)
 *
 * Architecture:
 * - ADMIN_PERMISSIONS: Enum of all available permissions
 * - ROLE_PERMISSIONS: Mapping of adminRoles → permissions
 * - hasAdminPermission(): Check function with isGestore bypass
 *
 * @module config/admin-permissions
 * @since 2.0.0
 */

/**
 * Admin permissions enum (flat, type-safe)
 * Format: section.action (always 2 parts)
 */
export const ADMIN_PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Users
  USERS_LIST: 'users.list',
  USERS_BAN: 'users.ban',
  USERS_UNBAN: 'users.unban',
  USERS_DELETE: 'users.delete',
  USERS_EDIT: 'users.edit',

  // Characters
  CHARACTERS_LIST: 'characters.list',
  CHARACTERS_APPROVE: 'characters.approve',
  CHARACTERS_REJECT: 'characters.reject',
  CHARACTERS_EDIT: 'characters.edit',
  CHARACTERS_DELETE: 'characters.delete',
  CHARACTERS_MANAGE_PERMISSIONS: 'characters.manage_permissions',

  // Documents
  DOCUMENTS_LIST: 'documents.list',
  DOCUMENTS_CREATE: 'documents.create',
  DOCUMENTS_EDIT: 'documents.edit',
  DOCUMENTS_DELETE: 'documents.delete',
  DOCUMENTS_PUBLISH: 'documents.publish',

  // System
  SYSTEM_BROADCAST: 'system.broadcast',
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_LOGS: 'system.logs',
  SYSTEM_MAINTENANCE: 'system.maintenance',

  // Tickets
  TICKETS_VIEW: 'tickets.view',
  TICKETS_ASSIGN: 'tickets.assign',
  TICKETS_RESOLVE: 'tickets.resolve',

  // Locations
  LOCATIONS_LIST: 'locations.list',
  LOCATIONS_EDIT: 'locations.edit',
  LOCATIONS_CREATE: 'locations.create',

  // Forum/Chat Moderation
  CHAT_MODERATE: 'chat.moderate',
  CHAT_DELETE: 'chat.delete',
  FORUM_MODERATE: 'forum.moderate',
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];

/**
 * Role-to-permissions mapping
 * Each role inherits permissions from previous roles
 */
export const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  /**
   * Personaggio (base role) - Dashboard access only
   */
  personaggio: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
  ],

  /**
   * Moderatore - Content moderation + user management
   */
  moderatore: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.USERS_LIST,
    ADMIN_PERMISSIONS.USERS_BAN,
    ADMIN_PERMISSIONS.USERS_UNBAN,
    ADMIN_PERMISSIONS.DOCUMENTS_LIST,
    ADMIN_PERMISSIONS.CHAT_MODERATE,
    ADMIN_PERMISSIONS.CHAT_DELETE,
    ADMIN_PERMISSIONS.FORUM_MODERATE,
    ADMIN_PERMISSIONS.TICKETS_VIEW,
    ADMIN_PERMISSIONS.TICKETS_RESOLVE,
  ],

  /**
   * Master - Game management + character approval
   */
  master: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.USERS_LIST,
    ADMIN_PERMISSIONS.USERS_BAN,
    ADMIN_PERMISSIONS.USERS_UNBAN,
    ADMIN_PERMISSIONS.CHARACTERS_LIST,
    ADMIN_PERMISSIONS.CHARACTERS_APPROVE,
    ADMIN_PERMISSIONS.CHARACTERS_REJECT,
    ADMIN_PERMISSIONS.CHARACTERS_EDIT,
    ADMIN_PERMISSIONS.DOCUMENTS_LIST,
    ADMIN_PERMISSIONS.DOCUMENTS_CREATE,
    ADMIN_PERMISSIONS.DOCUMENTS_EDIT,
    ADMIN_PERMISSIONS.DOCUMENTS_PUBLISH,
    ADMIN_PERMISSIONS.LOCATIONS_LIST,
    ADMIN_PERMISSIONS.LOCATIONS_EDIT,
    ADMIN_PERMISSIONS.CHAT_MODERATE,
    ADMIN_PERMISSIONS.CHAT_DELETE,
    ADMIN_PERMISSIONS.FORUM_MODERATE,
    ADMIN_PERMISSIONS.TICKETS_VIEW,
    ADMIN_PERMISSIONS.TICKETS_ASSIGN,
    ADMIN_PERMISSIONS.TICKETS_RESOLVE,
  ],

  /**
   * Amministratore - Full system access (except gestore-only operations)
   */
  amministratore: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.USERS_LIST,
    ADMIN_PERMISSIONS.USERS_BAN,
    ADMIN_PERMISSIONS.USERS_UNBAN,
    ADMIN_PERMISSIONS.USERS_EDIT,
    ADMIN_PERMISSIONS.USERS_DELETE,
    ADMIN_PERMISSIONS.CHARACTERS_LIST,
    ADMIN_PERMISSIONS.CHARACTERS_APPROVE,
    ADMIN_PERMISSIONS.CHARACTERS_REJECT,
    ADMIN_PERMISSIONS.CHARACTERS_EDIT,
    ADMIN_PERMISSIONS.CHARACTERS_DELETE,
    ADMIN_PERMISSIONS.CHARACTERS_MANAGE_PERMISSIONS,
    ADMIN_PERMISSIONS.DOCUMENTS_LIST,
    ADMIN_PERMISSIONS.DOCUMENTS_CREATE,
    ADMIN_PERMISSIONS.DOCUMENTS_EDIT,
    ADMIN_PERMISSIONS.DOCUMENTS_DELETE,
    ADMIN_PERMISSIONS.DOCUMENTS_PUBLISH,
    ADMIN_PERMISSIONS.LOCATIONS_LIST,
    ADMIN_PERMISSIONS.LOCATIONS_EDIT,
    ADMIN_PERMISSIONS.LOCATIONS_CREATE,
    ADMIN_PERMISSIONS.CHAT_MODERATE,
    ADMIN_PERMISSIONS.CHAT_DELETE,
    ADMIN_PERMISSIONS.FORUM_MODERATE,
    ADMIN_PERMISSIONS.SYSTEM_BROADCAST,
    ADMIN_PERMISSIONS.SYSTEM_CONFIG,
    ADMIN_PERMISSIONS.SYSTEM_LOGS,
    ADMIN_PERMISSIONS.TICKETS_VIEW,
    ADMIN_PERMISSIONS.TICKETS_ASSIGN,
    ADMIN_PERMISSIONS.TICKETS_RESOLVE,
  ],
};

/**
 * Check if character has admin permission
 *
 * Permission check order:
 * 1. isGestore bypass (grants all permissions)
 * 2. characterPermissions override (custom grants)
 * 3. adminRoles → ROLE_PERMISSIONS mapping
 *
 * @param adminRoles - Character's admin panel roles
 * @param characterPermissions - Character's custom permission overrides
 * @param isGestore - Gestore bypass flag (grants all permissions)
 * @param required - Required permission to check
 * @returns True if character has permission
 *
 * @example
 * ```typescript
 * hasAdminPermission(
 *   ['moderatore'],
 *   ['characters.approve'],
 *   false,
 *   ADMIN_PERMISSIONS.USERS_LIST
 * ) // true (from moderatore role)
 *
 * hasAdminPermission(
 *   ['personaggio'],
 *   [],
 *   true,
 *   ADMIN_PERMISSIONS.SYSTEM_MAINTENANCE
 * ) // true (gestore bypass)
 * ```
 */
export function hasAdminPermission(
  adminRoles: string[],
  characterPermissions: string[],
  isGestore: boolean,
  required: AdminPermission
): boolean {
  // UNICO bypass totale
  if (isGestore) {
    return true;
  }

  // Check custom permission overrides
  if (characterPermissions.includes(required)) {
    return true;
  }

  // Calculate permissions from adminRoles
  const rolePermissions = adminRoles.flatMap(role => ROLE_PERMISSIONS[role] || []);
  return rolePermissions.includes(required);
}

/**
 * Get all effective permissions for a character
 *
 * Calculates final permission list based on adminRoles + characterPermissions.
 * Used by /auth/effective-permissions endpoint.
 *
 * @param adminRoles - Character's admin panel roles
 * @param characterPermissions - Character's custom permission overrides
 * @param isGestore - Gestore bypass flag
 * @returns Array of effective permissions (empty if gestore, as they have all)
 *
 * @example
 * ```typescript
 * getEffectivePermissions(['moderatore'], ['characters.approve'], false)
 * // Returns: ['dashboard.view', 'users.list', 'users.ban', 'characters.approve', ...]
 *
 * getEffectivePermissions([], [], true)
 * // Returns: [] (gestore has implicit all access)
 * ```
 */
export function getEffectivePermissions(
  adminRoles: string[],
  characterPermissions: string[],
  isGestore: boolean
): AdminPermission[] {
  // Gestore bypass: return empty (implies all permissions)
  if (isGestore) {
    return [];
  }

  // Calculate from roles
  const rolePermissions = adminRoles.flatMap(role => ROLE_PERMISSIONS[role] || []);

  // Merge with custom permissions (deduplicate)
  const allPermissions = [...new Set([...rolePermissions, ...characterPermissions])];

  return allPermissions as AdminPermission[];
}
