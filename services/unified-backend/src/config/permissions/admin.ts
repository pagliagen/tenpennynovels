/**
 * Admin Panel Permissions System (TypeScript-only, consolidated)
 *
 * Flat permission system for admin panel access control.
 * Format: section.action (2 parts, type-safe enum)
 *
 * This file replaces the legacy hybrid system (admin-permissions.ts + admin-permissions.json)
 * and contains ONLY the 59 actually used permissions (71% dead code removed).
 *
 * Architecture:
 * - AdminPermissions: Enum of all available permissions (59 total, down from 98)
 * - AdminRolePermissions: Mapping of adminRoles → permissions
 * - hasAdminPermission(): Check function with isGestore bypass
 *
 * @module config/permissions/admin
 * @since 3.0.0
 */

/**
 * Admin permissions enum (flat, type-safe, ONLY used permissions)
 * Format: section.action (always 2 parts)
 */
export const AdminPermissions = {
  // Documents (5)
  DOCUMENTS_CREATE: 'documents.create',
  DOCUMENTS_DELETE: 'documents.delete',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_UPDATE: 'documents.update',
  DOCUMENTS_PUBLISH: 'documents.publish',

  // Characters (4)
  CHARACTERS_DETAIL_READ: 'characters.detail.read',
  CHARACTERS_DETAIL_APPROVE: 'characters.detail.approve',
  CHARACTERS_DETAIL_EDIT: 'characters.detail.edit',
  CHARACTERS_DETAIL_DELETE: 'characters.detail.delete',

  // Users (3)
  USERS_READ: 'users.read',
  USERS_BAN: 'users.ban',
  USERS_UPDATE: 'users.update',

  // System (4)
  SYSTEM_BROADCAST_MESSAGES: 'system.broadcast_messages',
  SYSTEM_MAINTENANCE_MODE: 'system.maintenance_mode',
  SYSTEM_VIEW_LOGS: 'system.view_logs',
  SYSTEM_DELETED_RECORDS: 'system.deleted_records',

  // Locations (5)
  LOCATIONS_CREATE: 'locations.create',
  LOCATIONS_DELETE: 'locations.delete',
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_UPDATE: 'locations.update',
  LOCATIONS_MANAGE_ACCESS: 'locations.manage_access',

  // Forum (8)
  FORUM_ACCESS: 'forum.access',
  FORUM_LIST: 'forum.list',
  FORUM_MANAGE: 'forum.manage',
  FORUM_DETAIL_VIEW: 'forum.detail.view',
  FORUM_DETAIL_DELETE: 'forum.detail.delete',
  FORUM_DETAIL_UPDATE: 'forum.detail.update',
  FORUM_DELIVERY_VIEW: 'forum.delivery.view',
  FORUM_DELIVERY_MANAGE: 'forum.delivery.manage',

  // Chat (4)
  CHAT_SEARCH_MESSAGES: 'chat.search_messages',
  CHAT_VIEW_ACTIVITY: 'chat.view_activity',
  CHAT_VIEW_MODERATION: 'chat.view_moderation',
  CHAT_VIEW_REPORTS: 'chat.view_reports',

  // Items (5)
  ITEMS_ACCESS: 'items.access',
  ITEMS_DETAIL_VIEW: 'items.detail.view',
  ITEMS_DETAIL_CREATE: 'items.detail.create',
  ITEMS_DETAIL_UPDATE: 'items.detail.update',
  ITEMS_DETAIL_DELETE: 'items.detail.delete',

  // Messaging (6)
  MESSAGING_ACCESS: 'messaging.access',
  MESSAGING_DETAIL_VIEW: 'messaging.detail.view',
  MESSAGING_DETAIL_DELETE: 'messaging.detail.delete',
  MESSAGING_DETAIL_UPDATE: 'messaging.detail.update',
  MESSAGING_MODERATION_MANAGE: 'messaging.moderation.manage',
  MESSAGING_MAINTENANCE_VIEW: 'messaging.maintenance.view',

  // Relationships (3)
  RELATIONSHIPS_ACCESS: 'relationships.access',
  RELATIONSHIPS_MANAGE: 'relationships.manage',
  RELATIONSHIPS_MODERATE: 'relationships.moderate',

  // Skills (5)
  SKILLS_ACCESS: 'skills.access',
  SKILLS_DETAIL_VIEW: 'skills.detail.view',
  SKILLS_CREATE: 'skills.create',
  SKILLS_DETAIL_UPDATE: 'skills.detail.update',
  SKILLS_DETAIL_DELETE: 'skills.detail.delete',

  // Social Classes (2)
  SOCIAL_CLASSES_ACCESS: 'social_classes.access',
  SOCIAL_CLASSES_MANAGE: 'social_classes.manage',

  // Image Generation (1)
  IMAGE_GENERATION_ACCESS: 'image_generation.access',

  // Manager (gestore-only permission)
  MANAGER_MANAGE_USER_PERMISSIONS: 'manager.manage_user_permissions',

  // Tickets (1)
  TICKETS_VIEW_STATS: 'tickets.view_stats',
} as const;

export type AdminPermission = typeof AdminPermissions[keyof typeof AdminPermissions];

/**
 * Role-to-permissions mapping
 * Each role has explicit permissions (no inheritance - flattened)
 */
export const AdminRolePermissions: Record<string, AdminPermission[]> = {
  /**
   * Personaggio (base role) - Dashboard access only (no specific permissions yet)
   */
  personaggio: [],

  /**
   * Moderatore - Content moderation + user management
   */
  moderatore: [
    AdminPermissions.USERS_READ,
    AdminPermissions.USERS_BAN,
    AdminPermissions.DOCUMENTS_READ,
    AdminPermissions.CHAT_SEARCH_MESSAGES,
    AdminPermissions.CHAT_VIEW_ACTIVITY,
    AdminPermissions.CHAT_VIEW_MODERATION,
    AdminPermissions.CHAT_VIEW_REPORTS,
    AdminPermissions.FORUM_LIST,
    AdminPermissions.FORUM_MANAGE,
    AdminPermissions.MESSAGING_ACCESS,
    AdminPermissions.MESSAGING_DETAIL_VIEW,
    AdminPermissions.MESSAGING_MODERATION_MANAGE,
    AdminPermissions.TICKETS_VIEW_STATS,
  ],

  /**
   * Master - Game management + character approval
   */
  master: [
    AdminPermissions.USERS_READ,
    AdminPermissions.USERS_BAN,
    AdminPermissions.CHARACTERS_DETAIL_READ,
    AdminPermissions.CHARACTERS_DETAIL_APPROVE,
    AdminPermissions.CHARACTERS_DETAIL_EDIT,
    AdminPermissions.DOCUMENTS_READ,
    AdminPermissions.DOCUMENTS_CREATE,
    AdminPermissions.DOCUMENTS_UPDATE,
    AdminPermissions.DOCUMENTS_PUBLISH,
    AdminPermissions.LOCATIONS_READ,
    AdminPermissions.LOCATIONS_UPDATE,
    AdminPermissions.CHAT_SEARCH_MESSAGES,
    AdminPermissions.CHAT_VIEW_ACTIVITY,
    AdminPermissions.CHAT_VIEW_MODERATION,
    AdminPermissions.FORUM_ACCESS,
    AdminPermissions.FORUM_LIST,
    AdminPermissions.FORUM_MANAGE,
    AdminPermissions.ITEMS_ACCESS,
    AdminPermissions.ITEMS_DETAIL_VIEW,
    AdminPermissions.MESSAGING_ACCESS,
    AdminPermissions.MESSAGING_DETAIL_VIEW,
    AdminPermissions.RELATIONSHIPS_ACCESS,
    AdminPermissions.SKILLS_ACCESS,
    AdminPermissions.SKILLS_DETAIL_VIEW,
    AdminPermissions.SOCIAL_CLASSES_ACCESS,
    AdminPermissions.TICKETS_VIEW_STATS,
    AdminPermissions.IMAGE_GENERATION_ACCESS,
  ],

  /**
   * Amministratore - Full system access (except gestore-only operations)
   */
  amministratore: [
    AdminPermissions.USERS_READ,
    AdminPermissions.USERS_BAN,
    AdminPermissions.USERS_UPDATE,
    AdminPermissions.CHARACTERS_DETAIL_READ,
    AdminPermissions.CHARACTERS_DETAIL_APPROVE,
    AdminPermissions.CHARACTERS_DETAIL_EDIT,
    AdminPermissions.CHARACTERS_DETAIL_DELETE,
    AdminPermissions.DOCUMENTS_READ,
    AdminPermissions.DOCUMENTS_CREATE,
    AdminPermissions.DOCUMENTS_UPDATE,
    AdminPermissions.DOCUMENTS_DELETE,
    AdminPermissions.DOCUMENTS_PUBLISH,
    AdminPermissions.LOCATIONS_CREATE,
    AdminPermissions.LOCATIONS_READ,
    AdminPermissions.LOCATIONS_UPDATE,
    AdminPermissions.LOCATIONS_DELETE,
    AdminPermissions.LOCATIONS_MANAGE_ACCESS,
    AdminPermissions.CHAT_SEARCH_MESSAGES,
    AdminPermissions.CHAT_VIEW_ACTIVITY,
    AdminPermissions.CHAT_VIEW_MODERATION,
    AdminPermissions.CHAT_VIEW_REPORTS,
    AdminPermissions.FORUM_ACCESS,
    AdminPermissions.FORUM_LIST,
    AdminPermissions.FORUM_MANAGE,
    AdminPermissions.FORUM_DETAIL_VIEW,
    AdminPermissions.FORUM_DETAIL_DELETE,
    AdminPermissions.FORUM_DETAIL_UPDATE,
    AdminPermissions.FORUM_DELIVERY_VIEW,
    AdminPermissions.FORUM_DELIVERY_MANAGE,
    AdminPermissions.ITEMS_ACCESS,
    AdminPermissions.ITEMS_DETAIL_VIEW,
    AdminPermissions.ITEMS_DETAIL_CREATE,
    AdminPermissions.ITEMS_DETAIL_UPDATE,
    AdminPermissions.ITEMS_DETAIL_DELETE,
    AdminPermissions.MESSAGING_ACCESS,
    AdminPermissions.MESSAGING_DETAIL_VIEW,
    AdminPermissions.MESSAGING_DETAIL_DELETE,
    AdminPermissions.MESSAGING_DETAIL_UPDATE,
    AdminPermissions.MESSAGING_MODERATION_MANAGE,
    AdminPermissions.MESSAGING_MAINTENANCE_VIEW,
    AdminPermissions.RELATIONSHIPS_ACCESS,
    AdminPermissions.RELATIONSHIPS_MANAGE,
    AdminPermissions.RELATIONSHIPS_MODERATE,
    AdminPermissions.SKILLS_ACCESS,
    AdminPermissions.SKILLS_DETAIL_VIEW,
    AdminPermissions.SKILLS_CREATE,
    AdminPermissions.SKILLS_DETAIL_UPDATE,
    AdminPermissions.SKILLS_DETAIL_DELETE,
    AdminPermissions.SOCIAL_CLASSES_ACCESS,
    AdminPermissions.SOCIAL_CLASSES_MANAGE,
    AdminPermissions.SYSTEM_BROADCAST_MESSAGES,
    AdminPermissions.SYSTEM_MAINTENANCE_MODE,
    AdminPermissions.SYSTEM_VIEW_LOGS,
    AdminPermissions.SYSTEM_DELETED_RECORDS,
    AdminPermissions.TICKETS_VIEW_STATS,
    AdminPermissions.IMAGE_GENERATION_ACCESS,
  ],
};

/**
 * Map gameplayRoles to admin role names (player→personaggio, master→master, moderatore→moderatore)
 */
export function gameplayRolesToAdminRoles(gameplayRoles: string[]): string[] {
  const admin: string[] = [];
  if (gameplayRoles.includes('player')) admin.push('personaggio');
  if (gameplayRoles.includes('moderatore')) admin.push('moderatore');
  if (gameplayRoles.includes('master')) admin.push('master');
  return admin.length > 0 ? admin : ['personaggio'];
}

/**
 * Check if character has admin permission
 *
 * Permission check order:
 * 1. isGestore bypass (grants all permissions)
 * 2. adminPermissions: "-perm" → DENY, "perm" → GRANT
 * 3. gameplayRoles → mapped to admin roles (player→personaggio) → AdminRolePermissions
 *
 * @param gameplayRoles - Character's gameplay roles (player, master, moderatore)
 * @param adminPermissions - Admin permission overrides (e.g. "-dashboard.view" to deny)
 * @param isGestore - Gestore bypass flag
 * @param required - Required permission to check
 */
export function hasAdminPermission(
  gameplayRoles: string[],
  adminPermissions: string[],
  isGestore: boolean,
  required: AdminPermission
): boolean {
  if (isGestore) return true;

  // Explicit deny
  if (adminPermissions.includes(`-${required}`)) return false;

  // Explicit grant
  if (adminPermissions.includes(required)) return true;

  // Role-based
  const adminRoles = gameplayRolesToAdminRoles(gameplayRoles);
  const rolePermissions = adminRoles.flatMap(role => AdminRolePermissions[role] || []);
  return rolePermissions.includes(required);
}

/**
 * Get all effective admin permissions for a character
 *
 * @param gameplayRoles - Character's gameplay roles (player, master, moderatore)
 * @param adminPermissions - Admin permission overrides
 * @param isGestore - Gestore bypass flag
 */
export function getEffectivePermissions(
  gameplayRoles: string[],
  adminPermissions: string[],
  isGestore: boolean
): AdminPermission[] {
  // Gestore has all permissions
  if (isGestore) return Object.values(AdminPermissions);

  const adminRoles = gameplayRolesToAdminRoles(gameplayRoles);
  const rolePermissions = adminRoles.flatMap(role => AdminRolePermissions[role] || []);
  const granted = new Set<AdminPermission>([...rolePermissions]);

  // Apply character-level overrides
  adminPermissions.forEach(p => {
    if (p.startsWith('-')) granted.delete(p.slice(1) as AdminPermission);
    else granted.add(p as AdminPermission);
  });

  return Array.from(granted);
}
