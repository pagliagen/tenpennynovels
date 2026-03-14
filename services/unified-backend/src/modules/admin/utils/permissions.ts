// =============================================================================
// Sistema di Autorizzazioni Granulari
// =============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { hasAdminPermission, AdminPermission, gameplayRolesToAdminRoles } from '@config/admin-permissions';
import { logger } from './logger';

interface PermissionConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
  };
  admin_roles: Record<string, {
    description: string;
    inherits?: string;
    permissions: string[];
  }>;
  user_roles: Record<string, {
    description: string;
  }>;
  menu_structure: Record<string, any>;
  dashboard_badges: Record<string, {
    permission: string;
    desc: string;
  }>;
  audit_actions: Record<string, string>;
}

let permissionConfig: PermissionConfig | null = null;

/**
 * Carica la configurazione dei permessi dal file JSON
 */
function loadPermissionConfig(): PermissionConfig {
  // In development, sempre ricarica per vedere i cambiamenti
  if (!permissionConfig || process.env.NODE_ENV === 'development') {
    const configPath = join(__dirname, '../../../config/roles/admin-permissions.json');
    const configData = readFileSync(configPath, 'utf-8');
    permissionConfig = JSON.parse(configData);
  }
  return permissionConfig!;
}

/**
 * Risolve i permessi per un ruolo admin, includendo l'ereditarietà.
 * Formato flat come game-permissions: array di stringhe "admin:resource:action"
 */
function resolveAdminRolePermissions(roleName: string, config: PermissionConfig): string[] {
  const role = config.admin_roles[roleName];
  if (!role) {
    logger.warn(`Admin role ${roleName} not found in permissions config`);
    return [];
  }

  let permissions = [...role.permissions];

  if (role.inherits) {
    const inheritedPermissions = resolveAdminRolePermissions(role.inherits, config);
    permissions = [...new Set([...inheritedPermissions, ...permissions])];
  }

  return permissions;
}

/**
 * Ottiene tutti i permessi effettivi (characterRoles = gameplayRoles, mapped to admin roles per config)
 */
function getResolvedPermissions(characterRoles: string[], characterPermissions: string[], isGestore: boolean, config: PermissionConfig): string[] {
  if (isGestore) return [];

  const adminRoles = gameplayRolesToAdminRoles(characterRoles);
  let permissions: string[] = [];
  for (const role of adminRoles) {
    permissions = [...new Set([...permissions, ...resolveAdminRolePermissions(role, config)])];
  }

  if (characterPermissions.includes('all')) {
    return []; // all = tutti i permessi
  }

  for (const p of characterPermissions) {
    if (p.startsWith('admin:')) {
      permissions.push(p);
    } else if (p.includes('.')) {
      const parts = p.split('.');
      if (parts.length === 2 && parts[1] === 'access') {
        permissions.push(`admin:${parts[0]}:access`);
      } else if (parts.length === 3 && parts[1] === 'detail') {
        permissions.push(`admin:${parts[0]}:${parts[2]}`);
      }
    }
  }

  return [...new Set(permissions)];
}

/**
 * Verifica se l'utente ha un permesso specifico (da config JSON)
 */
function hasPermissionFromConfig(
  characterRoles: string[],
  characterPermissions: string[],
  isGestore: boolean,
  requiredPermission: string
): boolean {
  if (isGestore) return true;

  const config = loadPermissionConfig();
  const resolved = getResolvedPermissions(characterRoles, characterPermissions, false, config);

  if (characterPermissions.includes('all')) return true;
  if (resolved.includes(requiredPermission)) return true;

  return false;
}

/**
 * Funzione principale per verificare accesso - haveAccessTo('dashboard')
 * characterRoles = gameplayRoles (player, master, moderatore); mapped to admin roles for config lookup
 */
export function haveAccessTo(section: string, userRoles: string[], characterRoles: string[], characterPermissions: string[] = []): boolean {
  if (characterPermissions.includes('all')) return true;

  const accessPermission = `admin:${section}:access`;
  if (characterPermissions.includes(accessPermission) || characterPermissions.includes(`${section}.access`)) return true;

  const config = loadPermissionConfig();
  const adminRoles = gameplayRolesToAdminRoles(characterRoles);
  for (const role of adminRoles) {
    const rolePermissions = resolveAdminRolePermissions(role, config);
    if (rolePermissions.includes(accessPermission)) return true;
  }

  return false;
}

/**
 * Converte permessi flat in struttura nested (per API backward compatibility)
 */
function flatToNestedPermissions(flatPermissions: string[]): Record<string, { access: boolean; detail: Record<string, boolean> }> {
  const result: Record<string, { access: boolean; detail: Record<string, boolean> }> = {};
  const allSections = ['dashboard', 'users', 'characters', 'content', 'documents', 'system', 'economy', 'locations', 'gamedata', 'skills', 'occupations', 'tickets'];

  for (const section of allSections) {
    result[section] = { access: false, detail: {} };
  }

  for (const p of flatPermissions) {
    if (!p.startsWith('admin:')) continue;
    const parts = p.slice(6).split(':');
    if (parts.length >= 2) {
      const section = parts[0];
      const action = parts[1];
      if (!result[section]) result[section] = { access: false, detail: {} };
      if (action === 'access') {
        result[section].access = true;
      } else {
        result[section].detail[action] = true;
      }
    }
  }

  return result;
}

/**
 * Ottieni tutti i permessi per un utente (characterRoles = gameplayRoles, characterPermissions = adminPermissions)
 */
export function getUserPermissions(userRoles: string[], characterRoles: string[], characterPermissions: string[] = []): any {
  const config = loadPermissionConfig();

  const adminRoles = gameplayRolesToAdminRoles(characterRoles);
  let flatPermissions: string[] = [];
  for (const role of adminRoles) {
    flatPermissions = [...new Set([...flatPermissions, ...resolveAdminRolePermissions(role, config)])];
  }

  if (characterPermissions.includes('all')) {
    flatPermissions = ['all'];
  } else {
    for (const p of characterPermissions) {
      if (p.startsWith('admin:')) {
        flatPermissions.push(p);
      } else if (p.includes('.')) {
        const parts = p.split('.');
        if (parts.length === 2 && parts[1] === 'access') {
          flatPermissions.push(`admin:${parts[0]}:access`);
        } else if (parts.length === 3 && parts[1] === 'detail') {
          flatPermissions.push(`admin:${parts[0]}:${parts[2]}`);
        }
      }
    }
  }

  if (flatPermissions.includes('all')) {
    const sections = ['dashboard', 'users', 'characters', 'content', 'documents', 'system', 'economy', 'locations', 'gamedata', 'skills', 'occupations', 'tickets'];
    const allDetail: Record<string, boolean> = {
      view_basic_stats: true, view_user_count: true, view_character_stats: true,
      view_system_health: true, view_gameplay_stats: true, view_financial_stats: true,
      view_activity_logs: true, read: true, create: true, update: true, delete: true,
      ban: true, approve: true, reject: true, edit: true, view_transactions: true,
      grant_money: true, adjust_balances: true, view_reports: true, manage_access: true,
      manage_groups: true, publish: true, view_logs: true, broadcast_messages: true, export_data: true,
      view: true, assign: true, close: true, manage_all: true, transfer: true, internal_notes: true
    };
    const allPermissions: any = {};
    for (const section of sections) {
      allPermissions[section] = { access: true, detail: { ...allDetail } };
    }
    return allPermissions;
  }

  return flatToNestedPermissions([...new Set(flatPermissions)]);
}

/**
 * Filtra i badge della dashboard in base ai permessi dell'utente
 */
export function getVisibleDashboardBadges(userRoles: string[], characterRoles: string[], characterPermissions: string[] = [], isGestore: boolean = false): string[] {
  const config = loadPermissionConfig();
  const visibleBadges: string[] = [];

  for (const [badgeId, badgeConfig] of Object.entries(config.dashboard_badges)) {
    if (badgeConfig.permission.startsWith('admin:')) {
      if (hasPermissionFromConfig(characterRoles, characterPermissions, isGestore, badgeConfig.permission)) {
        visibleBadges.push(badgeId);
      }
    } else {
      if (hasAdminPermission(characterRoles, characterPermissions, isGestore, badgeConfig.permission as AdminPermission)) {
        visibleBadges.push(badgeId);
      }
    }
  }

  return visibleBadges;
}

/**
 * Ottieni la struttura menu visibile per l'utente
 */
export function getVisibleMenuStructure(userRoles: string[], characterRoles: string[], characterPermissions: string[] = [], isGestore: boolean = false): any {
  const config = loadPermissionConfig();
  const visibleMenu: any = {};

  for (const [menuId, menuConfig] of Object.entries(config.menu_structure)) {
    if (haveAccessTo(menuId, userRoles, characterRoles, characterPermissions)) {
      visibleMenu[menuId] = {
        icon: menuConfig.icon,
        label: menuConfig.label,
        permission: menuConfig.permission
      };

      if (menuConfig.children) {
        const visibleChildren = menuConfig.children.filter((child: any) => {
          if (child.permission === 'manager.manage_user_permissions') {
            return userRoles.includes('gestore');
          }
          if (child.permission.startsWith('admin:')) {
            return hasPermissionFromConfig(characterRoles, characterPermissions, isGestore, child.permission);
          }
          return hasAdminPermission(characterRoles, characterPermissions, isGestore, child.permission as AdminPermission);
        });
        if (visibleChildren.length > 0) {
          visibleMenu[menuId].children = visibleChildren;
        }
      }
    }
  }

  return visibleMenu;
}

/**
 * Ottieni la descrizione di un'azione per l'audit log
 */
export function getAuditActionDescription(action: string): string {
  const config = loadPermissionConfig();
  return config.audit_actions[action] || `Azione sconosciuta: ${action}`;
}

/**
 * Middleware per verificare accesso a sezione
 * IMPORTANTE: Usa CHARACTER.gameplayRoles dal database (non JWT token)
 */
export function requireAccess(section: string) {
  return async (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        result: false,
        error: 'Autenticazione richiesta'
      });
    }

    try {
      // Import models
      const { User, Character } = await import('@database/models');
      const { AuthUtils } = await import('../utils/auth');

      // Fetch user from database
      const dbUser = await User.findById(user.userId);
      if (!dbUser) {
        return res.status(404).json({
          result: false,
          error: 'Utente non trovato'
        });
      }

      // Decode character_context cookie to get selected character
      const characterContext = req.cookies?.character_context;
      let characterContextData: { characterId: string; characterRoles: string[] } | undefined = undefined;
      if (characterContext) {
        characterContextData = AuthUtils.decodeCharacterContext(characterContext) || undefined;
      }

      // Fetch user's characters (soft delete filtered by plugin)
      const allCharacters = await Character.find({ userId: dbUser._id });

      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );

      const requestedCharacterId = req.query?.characterId as string;
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

      const characterRoles = selectedCharacter?.gameplayRoles || [];
      const userRoles = dbUser.userRoles || [];
      const characterPermissions = selectedCharacter?.adminPermissions || [];

      if (!haveAccessTo(section, userRoles, characterRoles, characterPermissions)) {
        logger.warn(`Access denied to ${section}`, {
          userId: user.userId,
          userRoles,
          characterRoles,
          characterPermissions
        });
        return res.status(403).json({
          result: false,
          error: `Access denied to ${section}`,
          action: 'ACCESS_DENIED'
        });
      }

      next();
    } catch (error: any) {
      logger.error('Error checking access:', error);
      return res.status(500).json({
        result: false,
        error: 'Access check failed'
      });
    }
  };
}

/**
 * Middleware per verificare permesso specifico
 * IMPORTANTE: Usa CHARACTER.gameplayRoles dal database (non JWT token)
 */
export function requireViewPermission(permission: AdminPermission) {
  return async (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        result: false,
        error: 'Autenticazione richiesta'
      });
    }

    try {
      // Import models
      const { User, Character } = await import('@database/models');
      const { AuthUtils } = await import('../utils/auth');

      // Fetch user from database
      const dbUser = await User.findById(user.userId);
      if (!dbUser) {
        return res.status(404).json({
          result: false,
          error: 'Utente non trovato'
        });
      }

      // Decode character_context cookie to get selected character
      const characterContext = req.cookies?.character_context;
      let characterContextData: { characterId: string; characterRoles: string[] } | undefined = undefined;
      if (characterContext) {
        characterContextData = AuthUtils.decodeCharacterContext(characterContext) || undefined;
      }

      const allCharacters = await Character.find({ userId: dbUser._id });
      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );
      const requestedCharacterId = req.query?.characterId as string;
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

      // Get gameplayRoles and adminPermissions from selected CHARACTER
      const gameplayRoles = selectedCharacter?.gameplayRoles || [];
      const adminPermissions = selectedCharacter?.adminPermissions || [];
      const isGestore = selectedCharacter?.isGestore || false;

      if (isGestore) return next();

      if (!hasAdminPermission(gameplayRoles, adminPermissions, isGestore, permission)) {
        logger.warn(`Permission denied: ${permission}`, {
          userId: user.userId,
          characterId: selectedCharacter?._id,
          gameplayRoles,
          adminPermissions,
          isGestore
        });
        return res.status(403).json({
          result: false,
          error: `Permission denied: ${permission}`,
          action: 'PERMISSION_DENIED'
        });
      }

      next();
    } catch (error: any) {
      logger.error('Error checking permissions:', error);
      return res.status(500).json({
        result: false,
        error: 'Controllo permessi fallito'
      });
    }
  };
}

/**
 * Legacy middleware per backward compatibility
 */
export function requirePermission(permission: AdminPermission) {
  return requireViewPermission(permission);
}

/**
 * Utility per log di debug dei permessi
 */
export function debugPermissions(userRoles: string[], characterRoles: string[], characterPermissions: string[] = []) {
  const config = loadPermissionConfig();
  const allPermissions = getUserPermissions(userRoles, characterRoles, characterPermissions);
  
  logger.debug('=== DEBUG PERMISSIONS ===');
  logger.debug('User Roles:', userRoles);
  logger.debug('Character Roles:', characterRoles);
  logger.debug('Character Permissions (override):', characterPermissions);
  logger.debug('========================');
}

/**
 * Controlla se l'utente può accedere agli audit logs (master = full admin, isGestore checked elsewhere)
 */
export function canViewAuditLogs(userRoles: string[], characterRoles: string[]): boolean {
  const adminRoles = gameplayRolesToAdminRoles(characterRoles);
  return adminRoles.includes('master');
}