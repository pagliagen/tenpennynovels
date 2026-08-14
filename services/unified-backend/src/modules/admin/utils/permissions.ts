// =============================================================================
// Sistema di Autorizzazioni Granulari (solo @config/permissions, nessun JSON)
// =============================================================================

import {
  hasAdminPermission,
  AdminPermission,
  AdminPermissions,
  gameplayRolesToAdminRoles,
  getEffectivePermissions,
} from '@config/permissions';
import { logger } from './logger';
import { AuthUtils } from '../utils/auth';

/**
 * Contesto personaggio per middleware admin: allineato a AdminAuthMiddleware
 * (X-Session-Id + Redis prima del cookie character_context deprecato).
 */
export async function resolveAdminCharacterSelectionContext(
  req: { headers?: NodeJS.Dict<string | string[] | undefined>; cookies?: Record<string, string | undefined> },
  userId: string
): Promise<{ characterId: string; characterRoles: string[] } | undefined> {
  const raw = req.headers?.['x-session-id'] ?? req.headers?.['X-Session-Id'];
  const sessionId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

  if (sessionId) {
    try {
      const { SessionStore } = await import('@core/auth/services/SessionStore');
      const session = await SessionStore.getSession(sessionId);
      if (session && session.userId === userId) {
        return { characterId: session.characterId, characterRoles: [] };
      }
    } catch (e: unknown) {
      logger.warn('[resolveAdminCharacterSelectionContext] Session lookup failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  const characterContext = req.cookies?.character_context;
  if (characterContext) {
    return AuthUtils.decodeCharacterContext(characterContext) || undefined;
  }

  return undefined;
}

/** Sezioni UI / middleware requireAccess: prefissi permesso `section...` (formato AdminPermission) */
const SECTION_ACCESS_PREFIXES: Record<string, string[]> = {
  dashboard: [],
  users: ['users.'],
  characters: ['characters.'],
  documents: ['documents.'],
  system: ['system.'],
  locations: ['locations.'],
  forum: ['forum.'],
  chat: ['chat.'],
  content: ['documents.', 'forum.', 'chat.'],
  economy: [],
  gamedata: ['items.', 'skills.', 'social_classes.', 'relationships.', 'forum.'],
  skills: ['skills.'],
  occupations: ['skills.'],
  tickets: ['tickets.'],
  items: ['items.'],
  messaging: ['messaging.'],
  relationships: ['relationships.'],
  social_classes: ['social_classes.'],
  manager: ['manager.'],
};

const PERMISSION_NEST_SECTIONS = [
  'dashboard',
  'users',
  'characters',
  'content',
  'documents',
  'system',
  'economy',
  'locations',
  'gamedata',
  'skills',
  'occupations',
  'tickets',
  'forum',
  'chat',
  'items',
  'messaging',
  'relationships',
  'social_classes',
  'manager',
];

function emptyNestedPermissions(): Record<string, { access: boolean; detail: Record<string, boolean> }> {
  const result: Record<string, { access: boolean; detail: Record<string, boolean> }> = {};
  for (const section of PERMISSION_NEST_SECTIONS) {
    result[section] = { access: false, detail: {} };
  }
  return result;
}

/**
 * Converte permessi effettivi (formato section.action[.sotto...]) in struttura nested per API legacy /admin/me
 */
function effectivePermissionsToNested(effective: AdminPermission[]): Record<string, { access: boolean; detail: Record<string, boolean> }> {
  const result = emptyNestedPermissions();
  for (const perm of effective) {
    const parts = perm.split('.');
    if (parts.length < 2) continue;
    const section = parts[0];
    if (!result[section]) {
      result[section] = { access: false, detail: {} };
    }
    const detailKey = parts.slice(1).join('.');
    result[section].detail[detailKey] = true;
    result[section].access = true;
  }
  return result;
}

/**
 * Verifica accesso a una sezione menu/management (characterRoles = gameplayRoles)
 */
export function haveAccessTo(
  section: string,
  userRoles: string[],
  characterRoles: string[],
  characterPermissions: string[] = [],
  isGestore = false
): boolean {
  if (isGestore) return true;
  if (characterPermissions.includes('all')) return true;

  const accessPermission = `admin:${section}:access`;
  if (characterPermissions.includes(accessPermission) || characterPermissions.includes(`${section}.access`)) {
    return true;
  }

  if (section === 'dashboard') {
    return true;
  }

  const prefixes = SECTION_ACCESS_PREFIXES[section];
  if (prefixes === undefined) {
    const effective = getEffectivePermissions(characterRoles, characterPermissions, isGestore);
    return effective.some(p => p.startsWith(`${section}.`));
  }

  if (prefixes.length === 0 && section === 'economy') {
    return characterPermissions.some(p => p.includes('economy'));
  }

  if (prefixes.length === 0) {
    return false;
  }

  const effective = getEffectivePermissions(characterRoles, characterPermissions, isGestore);
  for (const p of effective) {
    for (const prefix of prefixes) {
      if (p.startsWith(prefix)) return true;
    }
  }
  return false;
}

/**
 * Permessi nested per utente (characterRoles = gameplayRoles, characterPermissions = adminPermissions)
 */
export function getUserPermissions(
  userRoles: string[],
  characterRoles: string[],
  characterPermissions: string[] = [],
  isGestore = false
): Record<string, { access: boolean; detail: Record<string, boolean> }> {
  if (characterPermissions.includes('all')) {
    const allDetail: Record<string, boolean> = {
      view_basic_stats: true,
      view_user_count: true,
      view_character_stats: true,
      view_system_health: true,
      view_gameplay_stats: true,
      view_financial_stats: true,
      view_activity_logs: true,
      read: true,
      create: true,
      update: true,
      delete: true,
      ban: true,
      approve: true,
      reject: true,
      edit: true,
      view_transactions: true,
      grant_money: true,
      adjust_balances: true,
      view_reports: true,
      manage_access: true,
      manage_groups: true,
      publish: true,
      view_logs: true,
      broadcast_messages: true,
      export_data: true,
      view: true,
      assign: true,
      close: true,
      manage_all: true,
      transfer: true,
      internal_notes: true,
    };
    const allPermissions: Record<string, { access: boolean; detail: Record<string, boolean> }> = {};
    for (const section of PERMISSION_NEST_SECTIONS) {
      allPermissions[section] = { access: true, detail: { ...allDetail } };
    }
    return allPermissions;
  }

  const effective = getEffectivePermissions(characterRoles, characterPermissions, isGestore);
  return effectivePermissionsToNested(effective);
}

/** Badge dashboard: id → permesso richiesto */
const DASHBOARD_BADGES: Record<string, AdminPermission> = {
  character_stats: AdminPermissions.CHARACTERS_DETAIL_READ,
  user_activity: AdminPermissions.USERS_READ,
  system_health: AdminPermissions.SYSTEM_VIEW_LOGS,
  tickets_open: AdminPermissions.TICKETS_VIEW_STATS,
};

export function getVisibleDashboardBadges(
  userRoles: string[],
  characterRoles: string[],
  characterPermissions: string[] = [],
  isGestore = false
): string[] {
  const visibleBadges: string[] = [];
  for (const [badgeId, perm] of Object.entries(DASHBOARD_BADGES)) {
    if (hasAdminPermission(characterRoles, characterPermissions, isGestore, perm)) {
      visibleBadges.push(badgeId);
    }
  }
  return visibleBadges;
}

/**
 * Struttura menu management (allineata ai permessi TypeScript)
 */
const MENU_STRUCTURE: Record<
  string,
  { icon: string; label: string; permission: string; children?: Array<{ permission: string; label: string }> }
> = {
  dashboard: { icon: '📊', label: 'Dashboard', permission: 'dashboard' },
  users: {
    icon: '👥',
    label: 'Utenti',
    permission: 'users',
    children: [
      { permission: AdminPermissions.USERS_READ, label: 'Lista utenti' },
      { permission: AdminPermissions.USERS_BAN, label: 'Ban' },
    ],
  },
  characters: {
    icon: '🎭',
    label: 'Personaggi',
    permission: 'characters',
    children: [
      { permission: AdminPermissions.CHARACTERS_DETAIL_READ, label: 'Lista / dettaglio' },
      { permission: AdminPermissions.CHARACTERS_DETAIL_APPROVE, label: 'Approvazioni' },
      { permission: AdminPermissions.CHARACTERS_DETAIL_EDIT, label: 'Modifica' },
    ],
  },
  locations: {
    icon: '🗺️',
    label: 'Location',
    permission: 'locations',
    children: [{ permission: AdminPermissions.LOCATIONS_READ, label: 'Gestione location' }],
  },
  documents: {
    icon: '📄',
    label: 'Documenti',
    permission: 'documents',
    children: [
      { permission: AdminPermissions.DOCUMENTS_READ, label: 'Lista documenti' },
      { permission: AdminPermissions.DOCUMENTS_CREATE, label: 'Creazione' },
    ],
  },
  gamedata: {
    icon: '🎲',
    label: 'Dati di gioco',
    permission: 'gamedata',
    children: [
      { permission: AdminPermissions.SKILLS_ACCESS, label: 'Skills' },
      { permission: AdminPermissions.SOCIAL_CLASSES_ACCESS, label: 'Classi sociali' },
      { permission: AdminPermissions.ITEMS_ACCESS, label: 'Mercato / item' },
      { permission: AdminPermissions.FORUM_MANAGE, label: 'Forum' },
    ],
  },
  forum: {
    icon: '💬',
    label: 'Forum',
    permission: 'forum',
    children: [
      { permission: AdminPermissions.FORUM_ACCESS, label: 'Accesso forum' },
      { permission: AdminPermissions.FORUM_LIST, label: 'Lista' },
    ],
  },
  chat: {
    icon: '💭',
    label: 'Chat',
    permission: 'chat',
    children: [
      { permission: AdminPermissions.CHAT_SEARCH_MESSAGES, label: 'Ricerca messaggi' },
      { permission: AdminPermissions.CHAT_VIEW_MODERATION, label: 'Moderazione' },
    ],
  },
  system: {
    icon: '⚙️',
    label: 'Sistema',
    permission: 'system',
    children: [
      { permission: AdminPermissions.SYSTEM_VIEW_LOGS, label: 'Log' },
      { permission: AdminPermissions.SYSTEM_BROADCAST_MESSAGES, label: 'Broadcast' },
      { permission: AdminPermissions.SYSTEM_DELETED_RECORDS, label: 'Record cancellati' },
    ],
  },
  tickets: {
    icon: '🎫',
    label: 'Supporto',
    permission: 'tickets',
    children: [{ permission: AdminPermissions.TICKETS_VIEW_STATS, label: 'Ticket / statistiche' }],
  },
};

const AUDIT_ACTION_DESCRIPTIONS: Record<string, string> = {
  access_denied: 'Accesso negato',
  login: 'Accesso effettuato',
  logout: 'Uscita',
  create: 'Creazione risorsa',
  update: 'Aggiornamento risorsa',
  delete: 'Eliminazione risorsa',
  read: 'Lettura risorsa',
};

export function getVisibleMenuStructure(
  userRoles: string[],
  characterRoles: string[],
  characterPermissions: string[] = [],
  isGestore = false
): Record<string, { icon: string; label: string; permission: string; children?: Array<{ permission: string; label: string }> }> {
  const visibleMenu: Record<string, { icon: string; label: string; permission: string; children?: Array<{ permission: string; label: string }> }> = {};

  for (const [menuId, menuConfig] of Object.entries(MENU_STRUCTURE)) {
    if (!haveAccessTo(menuId, userRoles, characterRoles, characterPermissions, isGestore)) {
      continue;
    }

    visibleMenu[menuId] = {
      icon: menuConfig.icon,
      label: menuConfig.label,
      permission: menuConfig.permission,
    };

    if (menuConfig.children) {
      const visibleChildren = menuConfig.children.filter((child) => {
        if (child.permission === 'manager.manage_user_permissions') {
          return userRoles.includes('gestore');
        }
        return hasAdminPermission(
          characterRoles,
          characterPermissions,
          isGestore,
          child.permission as AdminPermission
        );
      });
      if (visibleChildren.length > 0) {
        visibleMenu[menuId].children = visibleChildren;
      }
    }
  }

  return visibleMenu;
}

export function getAuditActionDescription(action: string): string {
  return AUDIT_ACTION_DESCRIPTIONS[action] || `Azione: ${action}`;
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
      const { User } = await import('@core/auth/models/User');
      const { Character } = await import('@database/models');

      const dbUser = await User.findById(user.userId);
      if (!dbUser) {
        return res.status(404).json({
          result: false,
          error: 'Utente non trovato'
        });
      }

      const allCharacters = await Character.find({ userId: dbUser._id });

      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );

      const requestedCharacterId = req.query?.characterId as string;
      const characterContextData = await resolveAdminCharacterSelectionContext(req, user.userId);
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

      const characterRoles = selectedCharacter?.gameplayRoles || [];
      const userRoles = dbUser.userRoles || [];
      const characterPermissions = selectedCharacter?.adminPermissions || [];
      const isGestore = selectedCharacter?.isGestore || false;

      if (!haveAccessTo(section, userRoles, characterRoles, characterPermissions, isGestore)) {
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
      const { User } = await import('@core/auth/models/User');
      const { Character } = await import('@database/models');

      const dbUser = await User.findById(user.userId);
      if (!dbUser) {
        return res.status(404).json({
          result: false,
          error: 'Utente non trovato'
        });
      }

      const allCharacters = await Character.find({ userId: dbUser._id });
      const availableCharacters = AuthUtils.getAvailableCharacters(
        allCharacters,
        dbUser.multipleCharactersAllowed
      );
      const requestedCharacterId = req.query?.characterId as string;
      const characterContextData = await resolveAdminCharacterSelectionContext(req, user.userId);
      const selectedCharacter = AuthUtils.determineActiveCharacter(
        availableCharacters,
        requestedCharacterId,
        characterContextData
      );

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

export function requirePermission(permission: AdminPermission) {
  return requireViewPermission(permission);
}

export function debugPermissions(
  userRoles: string[],
  characterRoles: string[],
  characterPermissions: string[] = [],
  isGestore = false
) {
  const allPermissions = getUserPermissions(userRoles, characterRoles, characterPermissions, isGestore);

  logger.debug('=== DEBUG PERMISSIONS ===');
  logger.debug('User Roles:', userRoles);
  logger.debug('Character Roles:', characterRoles);
  logger.debug('Character Permissions (override):', characterPermissions);
  logger.debug('Effective nested:', allPermissions);
  logger.debug('========================');
}

export function canViewAuditLogs(userRoles: string[], characterRoles: string[]): boolean {
  const adminRoles = gameplayRolesToAdminRoles(characterRoles);
  return adminRoles.includes('master');
}
