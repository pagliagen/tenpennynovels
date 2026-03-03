// =============================================================================
// Game Permissions System
// =============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

interface GamePermissionConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
  };
  gameplay_roles: Record<string, {
    description: string;
    inherits?: string;
    permissions: string[];
  }>;
  status_restrictions: Record<string, {
    blocked_permissions: string[];
  }>;
}

let gamePermissionConfig: GamePermissionConfig | null = null;

/**
 * Load game permissions configuration from JSON file
 */
function loadGamePermissionConfig(): GamePermissionConfig {
  // In development, always reload to see changes
  if (!gamePermissionConfig || process.env.NODE_ENV === 'development') {
    try {
      const configPath = join(__dirname, '../../../config/roles/game-permissions.json');
      const configData = readFileSync(configPath, 'utf-8');
      gamePermissionConfig = JSON.parse(configData);
    } catch (error: any) {
      logger.error('Failed to load game permissions config:', error);
      throw new Error('Game permissions configuration not found');
    }
  }
  return gamePermissionConfig!;
}

/**
 * Resolve permissions for a gameplay role, including inheritance
 */
function resolveGameplayRolePermissions(roleName: string, config: GamePermissionConfig): string[] {
  const role = config.gameplay_roles[roleName];
  if (!role) {
    logger.warn(`Gameplay role ${roleName} not found in config`);
    return [];
  }

  let permissions = [...role.permissions];

  // If the role inherits from another role, merge permissions
  if (role.inherits) {
    const inheritedPermissions = resolveGameplayRolePermissions(role.inherits, config);
    // Use Set to avoid duplicates
    permissions = [...new Set([...inheritedPermissions, ...permissions])];
  }

  return permissions;
}

/**
 * Check if character has specific game permission
 *
 * Resolution order:
 * 1. isGestore = true → GRANT ALL (bypass everything)
 * 2. Status restrictions (DRAFT/PENDING_APPROVAL) → DENY chat/postal
 * 3. characterPermissions → GRANT if includes permission
 * 4. gameplayRoles → GRANT if role has permission
 * 5. Default → DENY
 */
export function hasGamePermission(
  permission: string,
  characterStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): boolean {
  // DEBUG: Log all parameters
  console.log('[hasGamePermission] Checking permission:', {
    permission,
    characterStatus,
    isGestore,
    gameplayRoles,
    characterPermissions
  });

  // 1. isGestore bypasses everything
  if (isGestore) {
    console.log('[hasGamePermission] GRANT - isGestore bypass');
    return true;
  }

  // 2. Check status-based restrictions (DRAFT/PENDING_APPROVAL cannot chat/postal)
  const config = loadGamePermissionConfig();
  const statusRestrictions = config.status_restrictions[characterStatus];
  if (statusRestrictions?.blocked_permissions.includes(permission)) {
    console.log('[hasGamePermission] DENY - status restriction');
    return false;
  }

  // 3. Check characterPermissions overrides
  if (characterPermissions.includes(permission) || characterPermissions.includes('game:*')) {
    console.log('[hasGamePermission] GRANT - characterPermissions override');
    return true;
  }

  // 4. Check gameplayRoles permissions
  // Fallback to default role if gameplayRoles is empty
  const roles = gameplayRoles.length > 0
    ? gameplayRoles
    : (characterStatus === 'APPROVED' ? ['approved-player'] : ['player']);

  console.log('[hasGamePermission] Checking roles:', roles);

  for (const roleName of roles) {
    const rolePermissions = resolveGameplayRolePermissions(roleName, config);
    console.log(`[hasGamePermission] Role '${roleName}' has ${rolePermissions.length} permissions`);
    console.log(`[hasGamePermission] Looking for '${permission}' in:`, rolePermissions.slice(0, 5), '...');

    if (rolePermissions.includes(permission) || rolePermissions.includes('game:*')) {
      console.log('[hasGamePermission] GRANT - role permission match');
      return true;
    }
  }

  // 5. Default deny
  console.log('[hasGamePermission] DENY - no match found');
  return false;
}

/**
 * Get all game permissions for a character
 * Used by session endpoint to send full permission list to frontend
 */
export function getCharacterGamePermissions(
  characterStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): string[] {
  // isGestore has ALL permissions
  if (isGestore) {
    return ['game:*'];
  }

  const config = loadGamePermissionConfig();
  const allPermissions = new Set<string>();

  // Fallback to default role if gameplayRoles is empty
  const roles = gameplayRoles.length > 0
    ? gameplayRoles
    : (characterStatus === 'APPROVED' ? ['approved-player'] : ['player']);

  // Merge all role permissions
  for (const roleName of roles) {
    const rolePermissions = resolveGameplayRolePermissions(roleName, config);
    rolePermissions.forEach(p => allPermissions.add(p));
  }

  // Add characterPermissions overrides
  characterPermissions.forEach(p => allPermissions.add(p));

  // Remove status-based restrictions
  const statusRestrictions = config.status_restrictions[characterStatus];
  if (statusRestrictions) {
    statusRestrictions.blocked_permissions.forEach(p => allPermissions.delete(p));
  }

  return Array.from(allPermissions).sort();
}

/**
 * Get all available gameplay roles
 */
export function getAvailableGameplayRoles(): string[] {
  const config = loadGamePermissionConfig();
  return Object.keys(config.gameplay_roles);
}

/**
 * Get role description
 */
export function getGameplayRoleDescription(roleName: string): string | null {
  const config = loadGamePermissionConfig();
  return config.gameplay_roles[roleName]?.description || null;
}
