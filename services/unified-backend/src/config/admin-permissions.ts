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

  // Users (flat)
  USERS_LIST: 'users.list',
  USERS_READ: 'users.read',
  USERS_BAN: 'users.ban',
  USERS_UNBAN: 'users.unban',
  USERS_DELETE: 'users.delete',
  USERS_EDIT: 'users.edit',
  USERS_UPDATE: 'users.update',

  // Characters (flat)
  CHARACTERS_LIST: 'characters.list',
  CHARACTERS_APPROVE: 'characters.approve',
  CHARACTERS_REJECT: 'characters.reject',
  CHARACTERS_EDIT: 'characters.edit',
  CHARACTERS_DELETE: 'characters.delete',
  CHARACTERS_MANAGE_PERMISSIONS: 'characters.manage_permissions',

  // Characters (granular detail permissions)
  CHARACTERS_DETAIL_READ: 'characters.detail.read',
  CHARACTERS_DETAIL_APPROVE: 'characters.detail.approve',
  CHARACTERS_DETAIL_EDIT: 'characters.detail.edit',
  CHARACTERS_DETAIL_DELETE: 'characters.detail.delete',

  // Documents
  DOCUMENTS_LIST: 'documents.list',
  DOCUMENTS_CREATE: 'documents.create',
  DOCUMENTS_EDIT: 'documents.edit',
  DOCUMENTS_DELETE: 'documents.delete',
  DOCUMENTS_PUBLISH: 'documents.publish',

  // System (flat)
  SYSTEM_BROADCAST: 'system.broadcast',
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_LOGS: 'system.logs',
  SYSTEM_MAINTENANCE: 'system.maintenance',

  // System (granular)
  SYSTEM_BROADCAST_MESSAGES: 'system.broadcast_messages',
  SYSTEM_MAINTENANCE_MODE: 'system.maintenance_mode',
  SYSTEM_VIEW_LOGS: 'system.view_logs',

  // Tickets
  TICKETS_VIEW: 'tickets.view',
  TICKETS_ASSIGN: 'tickets.assign',
  TICKETS_RESOLVE: 'tickets.resolve',

  // Locations (flat)
  LOCATIONS_LIST: 'locations.list',
  LOCATIONS_EDIT: 'locations.edit',
  LOCATIONS_CREATE: 'locations.create',

  // Locations (granular)
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_UPDATE: 'locations.update',
  LOCATIONS_DELETE: 'locations.delete',
  LOCATIONS_MANAGE_ACCESS: 'locations.manage_access',

  // Chat (flat)
  CHAT_MODERATE: 'chat.moderate',
  CHAT_DELETE: 'chat.delete',

  // Chat (granular)
  CHAT_SEARCH_MESSAGES: 'chat.search_messages',
  CHAT_VIEW_ACTIVITY: 'chat.view_activity',
  CHAT_VIEW_REPORTS: 'chat.view_reports',
  CHAT_VIEW_MODERATION: 'chat.view_moderation',

  // Forum (flat)
  FORUM_MODERATE: 'forum.moderate',

  // Forum (granular)
  FORUM_ACCESS: 'forum.access',
  FORUM_DETAIL_VIEW: 'forum.detail.view',
  FORUM_DETAIL_DELETE: 'forum.detail.delete',
  FORUM_DETAIL_UPDATE: 'forum.detail.update',
  FORUM_DELIVERY_VIEW: 'forum.delivery.view',
  FORUM_DELIVERY_MANAGE: 'forum.delivery.manage',

  // Economy
  ECONOMY_GRANT_MONEY: 'economy.grant_money',
  ECONOMY_ADJUST_BALANCES: 'economy.adjust_balances',
  ECONOMY_VIEW_REPORTS: 'economy.view_reports',

  // Items
  ITEMS_ACCESS: 'items.access',
  ITEMS_DETAIL_VIEW: 'items.detail.view',
  ITEMS_DETAIL_CREATE: 'items.detail.create',
  ITEMS_DETAIL_UPDATE: 'items.detail.update',
  ITEMS_DETAIL_DELETE: 'items.detail.delete',

  // Messaging
  MESSAGING_ACCESS: 'messaging.access',
  MESSAGING_DETAIL_VIEW: 'messaging.detail.view',
  MESSAGING_DETAIL_DELETE: 'messaging.detail.delete',
  MESSAGING_DETAIL_UPDATE: 'messaging.detail.update',
  MESSAGING_MODERATION_MANAGE: 'messaging.moderation.manage',
  MESSAGING_MAINTENANCE_VIEW: 'messaging.maintenance.view',

  // Relationships
  RELATIONSHIPS_ACCESS: 'relationships.access',
  RELATIONSHIPS_MANAGE: 'relationships.manage',
  RELATIONSHIPS_MODERATE: 'relationships.moderate',

  // Skills
  SKILLS_ACCESS: 'skills.access',
  SKILLS_DETAIL_VIEW: 'skills.detail.view',
  SKILLS_CREATE: 'skills.create',
  SKILLS_DETAIL_UPDATE: 'skills.detail.update',
  SKILLS_DETAIL_DELETE: 'skills.detail.delete',

  // Social Classes
  SOCIAL_CLASSES_ACCESS: 'social_classes.access',
  SOCIAL_CLASSES_MANAGE: 'social_classes.manage',

  // Manager (special role)
  MANAGER_MANAGE_USER_PERMISSIONS: 'manager.manage_user_permissions',
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
