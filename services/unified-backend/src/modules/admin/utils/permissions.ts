// =============================================================================
// Sistema di Autorizzazioni Granulari
// =============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { hasAdminPermission, AdminPermission } from '@config/admin-permissions';

interface PermissionConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
  };
  character_roles: Record<string, {
    description: string;
    inherits?: string;
    permissions: any;
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
 * Risolve i permessi per un ruolo CHARACTER, includendo l'ereditarietà
 */
function resolveCharacterRolePermissions(roleName: string, config: PermissionConfig): any {
  const role = config.character_roles[roleName];
  if (!role) {
    console.warn(`Character role ${roleName} not found in permissions config`);
    return {};
  }

  let permissions = JSON.parse(JSON.stringify(role.permissions)); // Deep copy
  
  // Se il ruolo eredita da un altro ruolo, unisci i permessi
  if (role.inherits) {
    const inheritedPermissions = resolveCharacterRolePermissions(role.inherits, config);
    
    // Unisci i permessi, dando precedenza a quelli del ruolo corrente
    for (const section in inheritedPermissions) {
      if (!permissions[section]) {
        permissions[section] = { access: false, detail: {} };
      }
      
      // Merge access
      if (inheritedPermissions[section].access && !permissions[section].hasOwnProperty('access')) {
        permissions[section].access = inheritedPermissions[section].access;
      }
      
      // Merge detail permissions
      if (!permissions[section].detail) {
        permissions[section].detail = {};
      }
      permissions[section].detail = {
        ...inheritedPermissions[section].detail,
        ...permissions[section].detail
      };
    }
  }
  
  return permissions;
}

/**
 * Funzione principale per verificare accesso - haveAccessTo('dashboard')
 */
export function haveAccessTo(section: string, userRoles: string[], characterRoles: string[], characterPermissions: string[] = []): boolean {
  // CHARACTER.GESTORE ha sempre accesso a tutto senza filtri
  if (characterRoles.includes('gestore')) {
    return true;
  }

  // Controlla i permessi specifici del personaggio per override
  if (characterPermissions.includes('all') || characterPermissions.includes(`${section}.access`)) {
    return true;
  }

  // Controlla i permessi dei ruoli CHARACTER
  const config = loadPermissionConfig();
  for (const role of characterRoles) {
    const rolePermissions = resolveCharacterRolePermissions(role, config);
    if (rolePermissions[section]?.access === true) {
      return true;
    }
  }

  return false;
}

/**
 * Ottieni tutti i permessi per un utente (CHARACTER roles + characterPermissions override)
 */
export function getUserPermissions(userRoles: string[], characterRoles: string[], characterPermissions: string[] = []): any {
  const config = loadPermissionConfig();
  let allPermissions: any = {};

  // Se CHARACTER ha ruolo GESTORE, ha tutti i permessi senza filtri
  if (characterRoles.includes('gestore')) {
    const sections = ['dashboard', 'users', 'characters', 'content', 'documents', 'system', 'economy', 'locations'];
    for (const section of sections) {
      allPermissions[section] = {
        access: true,
        detail: {
          view_basic_stats: true, view_user_count: true, view_character_stats: true,
          view_system_health: true, view_gameplay_stats: true, view_financial_stats: true,
          view_activity_logs: true, read: true, create: true, update: true, delete: true,
          ban: true, change_permissions: true, approve: true, reject: true, edit: true,
          view_transactions: true, grant_money: true, adjust_balances: true, view_reports: true,
          manage_access: true, manage_groups: true, publish: true, view_logs: true, maintenance_mode: true,
          broadcast_messages: true, export_data: true
        }
      };
    }
    return allPermissions;
  }

  // Accumula permessi da tutti i ruoli CHARACTER
  for (const role of characterRoles) {
    const rolePermissions = resolveCharacterRolePermissions(role, config);

    for (const section in rolePermissions) {
      if (!allPermissions[section]) {
        allPermissions[section] = { access: false, detail: {} };
      }

      // Merge access
      if (rolePermissions[section].access) {
        allPermissions[section].access = true;
      }

      // Merge detail permissions
      allPermissions[section].detail = {
        ...allPermissions[section].detail,
        ...rolePermissions[section].detail
      };
    }
  }

  // Applica characterPermissions come override (eccezioni specifiche)
  if (characterPermissions.includes('all')) {
    for (const section in allPermissions) {
      allPermissions[section].access = true;
      for (const action in allPermissions[section].detail) {
        allPermissions[section].detail[action] = true;
      }
    }
  } else {
    for (const permission of characterPermissions) {
      const parts = permission.split('.');
      if (parts.length === 2 && parts[1] === 'access') {
        if (!allPermissions[parts[0]]) {
          allPermissions[parts[0]] = { access: false, detail: {} };
        }
        allPermissions[parts[0]].access = true;
      } else if (parts.length === 3 && parts[1] === 'detail') {
        if (!allPermissions[parts[0]]) {
          allPermissions[parts[0]] = { access: false, detail: {} };
        }
        allPermissions[parts[0]].detail[parts[2]] = true;
      }
    }
  }

  return allPermissions;
}

/**
 * Filtra i badge della dashboard in base ai permessi dell'utente
 */
export function getVisibleDashboardBadges(userRoles: string[], characterRoles: string[], characterPermissions: string[] = [], isGestore: boolean = false): string[] {
  const config = loadPermissionConfig();
  const visibleBadges: string[] = [];

  for (const [badgeId, badgeConfig] of Object.entries(config.dashboard_badges)) {
    // Use new permission system
    if (hasAdminPermission(characterRoles, characterPermissions, isGestore, badgeConfig.permission as AdminPermission)) {
      visibleBadges.push(badgeId);
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
    // Controlla se l'utente ha accesso al menu principale
    if (haveAccessTo(menuId, userRoles, characterRoles, characterPermissions)) {
      visibleMenu[menuId] = {
        icon: menuConfig.icon,
        label: menuConfig.label,
        permission: menuConfig.permission
      };

      // Filtra i sottomenu se esistono
      if (menuConfig.children) {
        const visibleChildren = menuConfig.children.filter((child: any) => {
          // Use new permission system for all permissions
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
        error: 'Authentication required'
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
          error: 'User not found'
        });
      }

      // Decode character_context cookie to get selected character
      const characterContext = req.cookies?.character_context;
      let characterContextData: { characterId: string; characterRoles: string[] } | undefined = undefined;
      if (characterContext) {
        characterContextData = AuthUtils.decodeCharacterContext(characterContext) || undefined;
      }

      // Fetch user's characters
      const allCharacters = await Character.find({
        userId: dbUser._id,
        status: { $ne: 'DELETED' }
      });

      // Filter based on multipleCharactersAllowed setting
      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );

      // Determine active character
      const requestedCharacterId = req.query?.characterId as string;
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

      // Get CHARACTER roles (from selected character's gameplayRoles)
      const characterRoles = selectedCharacter?.gameplayRoles || dbUser.characterRoles || [];
      const userRoles = dbUser.userRoles || [];
      const characterPermissions = dbUser.characterPermissions || [];

      if (!haveAccessTo(section, userRoles, characterRoles, characterPermissions)) {
        console.warn(`Access denied to ${section}`, {
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
      console.error('Error checking access:', error);
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
        error: 'Authentication required'
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
          error: 'User not found'
        });
      }

      // Decode character_context cookie to get selected character
      const characterContext = req.cookies?.character_context;
      let characterContextData: { characterId: string; characterRoles: string[] } | undefined = undefined;
      if (characterContext) {
        characterContextData = AuthUtils.decodeCharacterContext(characterContext) || undefined;
      }

      // Fetch user's characters
      const allCharacters = await Character.find({
        userId: dbUser._id,
        status: { $ne: 'DELETED' }
      });

      // Filter based on multipleCharactersAllowed setting
      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );

      // Determine active character
      const requestedCharacterId = req.query?.characterId as string;
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

      // Get admin roles and permissions from selected CHARACTER (not User)
      const adminRoles = selectedCharacter?.adminRoles || [];
      const characterPermissions = selectedCharacter?.characterPermissions || [];
      const isGestore = selectedCharacter?.isGestore || false;

      // UNICO bypass: Character.isGestore
      if (isGestore) {
        return next();
      }

      // Check permission using flat system
      if (!hasAdminPermission(adminRoles, characterPermissions, isGestore, permission)) {
        console.warn(`Permission denied: ${permission}`, {
          userId: user.userId,
          characterId: selectedCharacter?._id,
          adminRoles,
          characterPermissions,
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
      console.error('Error checking permissions:', error);
      return res.status(500).json({
        result: false,
        error: 'Permission check failed'
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
  
  console.log('=== DEBUG PERMISSIONS ===');
  console.log('User Roles:', userRoles);
  console.log('Character Roles:', characterRoles);
  console.log('Character Permissions (override):', characterPermissions);
  console.log('========================');
}

/**
 * Controlla se l'utente può accedere agli audit logs (solo GESTORE o AMMINISTRATORE)
 */
export function canViewAuditLogs(userRoles: string[], characterRoles: string[]): boolean {
  return characterRoles.includes('gestore') || characterRoles.includes('amministratore');
}