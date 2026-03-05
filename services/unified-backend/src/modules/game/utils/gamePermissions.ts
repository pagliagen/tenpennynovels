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
 * 1. isGestore = true → GRANT ALL
 * 2. characterPermissions: "-permission" → DENY, "permission" or "game:*" → GRANT
 * 3. gameplayRoles (player, master, moderatore) → GRANT if role has permission
 * 4. Default → DENY
 */
export function hasGamePermission(
  permission: string,
  playerStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): boolean {
  if (isGestore) return true;

  // Deny overrides (prefix -)
  const denyKey = permission.startsWith('-') ? permission : `-${permission}`;
  if (characterPermissions.includes(denyKey)) return false;

  // Grant overrides
  if (characterPermissions.includes(permission) || characterPermissions.includes('game:*')) return true;

  const config = loadGamePermissionConfig();
  const roles = gameplayRoles.length > 0 ? gameplayRoles : ['player'];

  for (const roleName of roles) {
    const rolePermissions = resolveGameplayRolePermissions(roleName, config);
    if (rolePermissions.includes(permission) || rolePermissions.includes('game:*')) return true;
  }

  return false;
}

/**
 * Get all game permissions for a character
 * Used by session endpoint to send full permission list to frontend
 */
export function getCharacterGamePermissions(
  playerStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): string[] {
  if (isGestore) return ['game:*'];

  const config = loadGamePermissionConfig();
  const allPermissions = new Set<string>();
  const roles = gameplayRoles.length > 0 ? gameplayRoles : ['player'];

  for (const roleName of roles) {
    resolveGameplayRolePermissions(roleName, config).forEach(p => allPermissions.add(p));
  }

  // Apply overrides: add grants, remove denials
  characterPermissions.forEach(p => {
    if (p.startsWith('-')) allPermissions.delete(p.slice(1));
    else allPermissions.add(p);
  });

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
