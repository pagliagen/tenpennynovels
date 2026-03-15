/**
 * Unified Permissions System
 * Single source of truth for all permissions (admin + game)
 *
 * This module consolidates the entire permission system into TypeScript-only files,
 *
 * Usage:
 * ```typescript
 * import { AdminPermissions, GamePermissions, hasAdminPermission, hasGamePermission } from '@config/permissions';
 * ```
 *
 * @module config/permissions
 * @since 3.0.0
 */

// ============================================================================
// Admin Permissions
// ============================================================================

export {
  AdminPermissions,
  AdminRolePermissions,
  gameplayRolesToAdminRoles,
  hasAdminPermission,
  getEffectivePermissions,
  type AdminPermission,
} from './admin';

// ============================================================================
// Game Permissions
// ============================================================================

export {
  GamePermissions,
  GameRolePermissions,
  StatusRestrictions,
  hasGamePermission,
  getCharacterGamePermissions,
  canReadOthersPrivate,
  type GamePermission,
} from './game';
