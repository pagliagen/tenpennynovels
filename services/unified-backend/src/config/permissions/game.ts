/**
 * Game Permissions System (TypeScript-only, migrated from JSON)
 *
 * Type-safe permission system for game runtime operations.
 * Format: game:section:action (3 parts)
 *
 * Architecture:
 * - GamePermissions: Enum of all available permissions (~150 total)
 * - GameRolePermissions: Mapping of gameplayRoles → permissions (with inheritance pre-resolved)
 * - StatusRestrictions: Permissions blocked by character status (draft/pending)
 * - hasGamePermission(): Check function with status restrictions and isGestore bypass
 *
 * @module config/permissions/game
 * @since 3.0.0
 */

/**
 * Game permissions enum (type-safe)
 * Format: game:section:action
 */
export const GamePermissions = {
  // Character
  CHARACTER_READ_OWN: 'game:character:read:own',
  CHARACTER_READ: 'game:character:read',
  CHARACTER_READ_OTHERS_PUBLIC: 'game:character:read:others:public',
  CHARACTER_READ_OTHERS_PRIVATE: 'game:character:read:others:private', // master only
  CHARACTER_UPDATE: 'game:character:update',
  CHARACTER_SUBMIT: 'game:character:submit',
  CHARACTER_SELECT: 'game:character:select',
  CHARACTER_LIST_OWN: 'game:character:list:own',
  CHARACTER_CREATE: 'game:character:create',
  CHARACTER_DELETE: 'game:character:delete',

  // Character Details
  CHARACTER_BACKGROUND_READ: 'game:character:background:read',
  CHARACTER_BACKGROUND_WRITE: 'game:character:background:write',
  CHARACTER_SKILLS_READ: 'game:character:skills:read',
  CHARACTER_OCCUPATIONS_READ: 'game:character:occupations:read',
  CHARACTER_PROGRESSION_READ: 'game:character:progression:read',
  CHARACTER_PROGRESSION_MODIFY: 'game:character:progression:modify',
  CHARACTER_CORPORATIONS_READ: 'game:character:corporations:read',

  // Documents
  DOCUMENTS_ROUTES_LIST: 'game:documents:routes:list',
  DOCUMENTS_ROUTES_LIST_HIERARCHICAL: 'game:documents:routes:list-hierarchical',
  DOCUMENTS_READ: 'game:documents:read',
  DOCUMENTS_SEARCH: 'game:documents:search',
  DOCUMENTS_FAVORITES_READ: 'game:documents:favorites:read',
  DOCUMENTS_FAVORITES_TOGGLE: 'game:documents:favorites:toggle',

  // Character Creation
  CHARACTER_CREATION_CONFIG: 'game:character-creation:config',
  CHARACTER_CREATION_OCCUPATIONS: 'game:character-creation:occupations',
  CHARACTER_CREATION_SKILLS: 'game:character-creation:skills',

  // Environment
  ENVIRONMENT_READ: 'game:environment:read',
  PRESENCE_READ: 'game:presence:read',

  // Locations
  LOCATIONS_LIST: 'game:locations:list',
  LOCATIONS_READ: 'game:locations:read',
  LOCATIONS_ENTER: 'game:locations:enter',
  LOCATIONS_LEAVE: 'game:locations:leave',
  LOCATIONS_CHECK_ACCESS: 'game:locations:check-access',
  LOCATIONS_LIST_OCCUPANTS: 'game:locations:list-occupants',
  LOCATIONS_TAG_OCCUPANT: 'game:locations:tag-occupant',
  LOCATIONS_JOIN_WEBSOCKET: 'game:locations:join-websocket',
  LOCATIONS_GRANT_ACCESS: 'game:locations:grant-access', // master only

  // Block Notes
  BLOCK_NOTES_READ: 'game:block-notes:read',
  BLOCK_NOTES_WRITE: 'game:block-notes:write',
  BLOCK_NOTES_DELETE: 'game:block-notes:delete',

  // Quests
  QUESTS_READ: 'game:quests:read',
  QUESTS_CREATE: 'game:quests:create', // master
  QUESTS_START: 'game:quests:start', // master
  QUESTS_END: 'game:quests:end', // master
  QUESTS_ACTION_MODE: 'game:quests:action-mode', // master
  QUESTS_REVEAL_ACTIONS: 'game:quests:reveal-actions', // master

  // Chat
  CHAT_SEND: 'game:chat:send',
  CHAT_WHISPER: 'game:chat:whisper',
  CHAT_OFFGAME: 'game:chat:offgame',
  CHAT_DICE: 'game:chat:dice',
  CHAT_SOCIAL_CLASH: 'game:chat:social-clash',
  CHAT_READ: 'game:chat:read',
  CHAT_EDIT: 'game:chat:edit',
  CHAT_DELETE: 'game:chat:delete', // master/moderatore
  CHAT_MASTER_ACTION: 'game:chat:master-action', // master
  CHAT_MODERATION_ACTION: 'game:chat:moderation-action', // moderatore
  CHAT_USE_FAKE_PNG: 'game:chat:use-fake-png', // master (PNG Light masking)
  CHAT_SOCIAL_CONFLICTS: 'game:chat:social-conflicts', // master

  // Messages
  MESSAGES_SEND: 'game:messages:send',
  MESSAGES_READ: 'game:messages:read',
  MESSAGES_DELETE: 'game:messages:delete',

  // Postal
  POSTAL_READ: 'game:postal:read',
  POSTAL_TYPES: 'game:postal:types',
  POSTAL_THREADS: 'game:postal:threads',
  POSTAL_SEND: 'game:postal:send',
  POSTAL_DELETE: 'game:postal:delete',

  // Off-game Chat
  OFFGAME_CHAT_LIST: 'game:offgame-chat:list',
  OFFGAME_CHAT_CREATE: 'game:offgame-chat:create',
  OFFGAME_CHAT_READ: 'game:offgame-chat:read',
  OFFGAME_CHAT_SEND: 'game:offgame-chat:send',
  OFFGAME_CHAT_EDIT: 'game:offgame-chat:edit',
  OFFGAME_CHAT_LEAVE: 'game:offgame-chat:leave',
  OFFGAME_CHAT_TYPING: 'game:offgame-chat:typing',

  // Economy
  ECONOMY_WALLET_READ: 'game:economy:wallet:read',
  ECONOMY_TRANSFER: 'game:economy:transfer',
  ECONOMY_TRANSACTIONS_READ: 'game:economy:transactions:read',

  // Shops
  SHOPS_LIST: 'game:shops:list',
  SHOPS_READ: 'game:shops:read',
  SHOPS_PURCHASE: 'game:shops:purchase',

  // Items
  ITEMS_LIST: 'game:items:list',
  ITEMS_READ: 'game:items:read',
  ITEMS_SEARCH: 'game:items:search',
  ITEMS_CATEGORIES: 'game:items:categories',

  // Corporations
  CORPORATIONS_LIST: 'game:corporations:list',
  CORPORATIONS_READ: 'game:corporations:read',
  CORPORATIONS_JOIN: 'game:corporations:join',
  CORPORATIONS_LEAVE: 'game:corporations:leave',
  CORPORATIONS_INVITATIONS_READ: 'game:corporations:invitations:read',
  CORPORATIONS_INVITATIONS_RESPOND: 'game:corporations:invitations:respond',

  // Relationships
  RELATIONSHIPS_LIST: 'game:relationships:list',
  RELATIONSHIPS_TYPES: 'game:relationships:types',
  RELATIONSHIPS_PROPOSE: 'game:relationships:propose',
  RELATIONSHIPS_RESPOND: 'game:relationships:respond',
  RELATIONSHIPS_END: 'game:relationships:end',

  // Housing
  HOUSING_DISTRICTS: 'game:housing:districts',
  HOUSING_AVAILABLE: 'game:housing:available',
  HOUSING_MY_PROPERTIES: 'game:housing:my-properties',
  HOUSING_READ: 'game:housing:read',
  HOUSING_RENT: 'game:housing:rent',
  HOUSING_PURCHASE: 'game:housing:purchase',
  HOUSING_PAY_RENT: 'game:housing:pay-rent',
  HOUSING_MANAGE_GUESTS: 'game:housing:manage-guests',

  // Experience
  EXPERIENCE_READ: 'game:experience:read',
  EXPERIENCE_STATS: 'game:experience:stats',
  EXPERIENCE_SPEND: 'game:experience:spend',

  // Occupations
  OCCUPATIONS_LIST: 'game:occupations:list',
  OCCUPATIONS_READ: 'game:occupations:read',
  OCCUPATIONS_CATEGORIES: 'game:occupations:categories',
  OCCUPATIONS_CHECK_ELIGIBILITY: 'game:occupations:check-eligibility',

  // Skills
  SKILLS_LIST: 'game:skills:list',
  SKILLS_READ: 'game:skills:read',
  SKILLS_CATEGORIES: 'game:skills:categories',
  SKILLS_PLACEHOLDERS: 'game:skills:placeholders',
  SKILLS_PROBABILITIES: 'game:skills:probabilities',

  // Session
  SESSION_INIT: 'game:session:init',
  SESSION_CURRENT: 'game:session:current',
  SESSION_ACTIVE: 'game:session:active',
  SESSION_HISTORY: 'game:session:history',
  SESSION_INVALIDATE: 'game:session:invalidate',
  SESSION_INVALIDATE_OTHERS: 'game:session:invalidate-others',

  // Typing
  TYPING_SEND: 'game:typing:send',

  // Status
  STATUS_READ: 'game:status:read',

  // Events
  EVENTS_REPLAY: 'game:events:replay',
  EVENTS_LATEST: 'game:events:latest',

  // Moderation
  MODERATION_REPORT_SEND: 'game:moderation:report:send',
  MODERATION_REPORT_READ_OWN: 'game:moderation:report:read:own',
  MODERATION_REPORT_READ_ALL: 'game:moderation:report:read:all', // moderatore
  MODERATION_ACTIONS_READ_OWN: 'game:moderation:actions:read:own',
  MODERATION_ACTIONS_CREATE: 'game:moderation:actions:create', // moderatore
  MODERATION_ACTIONS_READ_ALL: 'game:moderation:actions:read:all', // moderatore
  MODERATION_APPEAL_SEND: 'game:moderation:appeal:send',
  MODERATION_CHECK_CHAT_STATUS: 'game:moderation:check:chat-status',
  MODERATION_CHAT_CLEAR: 'game:moderation:chat:clear', // master/moderatore

  // Admin (master-only operations)
  ADMIN_SHOPS_RESTOCK: 'game:admin:shops:restock', // master
  ADMIN_ECONOMY_GRANT: 'game:admin:economy:grant', // master
  ADMIN_ECONOMY_RESET_CREDIT: 'game:admin:economy:reset-credit', // master
  ADMIN_ECONOMY_STATUS: 'game:admin:economy:status', // master
  ADMIN_EXPERIENCE_GRANT: 'game:admin:experience:grant', // master
  ADMIN_TIME_ADVANCE: 'game:admin:time:advance', // master
} as const;

export type GamePermission = typeof GamePermissions[keyof typeof GamePermissions];

/**
 * Role-to-permissions mapping (inheritance pre-resolved for performance)
 * Note: master and moderatore inherit ALL player permissions + their specific ones
 */
export const GameRolePermissions: Record<string, GamePermission[]> = {
  /**
   * Player - Base role with full game access (draft/pending restrictions handled separately)
   */
  player: [
    GamePermissions.CHARACTER_READ_OWN,
    GamePermissions.CHARACTER_READ,
    GamePermissions.CHARACTER_READ_OTHERS_PUBLIC,
    GamePermissions.CHARACTER_UPDATE,
    GamePermissions.CHARACTER_SUBMIT,
    GamePermissions.CHARACTER_BACKGROUND_READ,
    GamePermissions.CHARACTER_BACKGROUND_WRITE,
    GamePermissions.CHARACTER_SKILLS_READ,
    GamePermissions.CHARACTER_OCCUPATIONS_READ,
    GamePermissions.DOCUMENTS_ROUTES_LIST,
    GamePermissions.DOCUMENTS_ROUTES_LIST_HIERARCHICAL,
    GamePermissions.DOCUMENTS_READ,
    GamePermissions.DOCUMENTS_SEARCH,
    GamePermissions.DOCUMENTS_FAVORITES_READ,
    GamePermissions.DOCUMENTS_FAVORITES_TOGGLE,
    GamePermissions.CHARACTER_CREATION_CONFIG,
    GamePermissions.CHARACTER_CREATION_OCCUPATIONS,
    GamePermissions.CHARACTER_CREATION_SKILLS,
    GamePermissions.ENVIRONMENT_READ,
    GamePermissions.PRESENCE_READ,
    GamePermissions.LOCATIONS_LIST,
    GamePermissions.OFFGAME_CHAT_LIST,
    GamePermissions.POSTAL_READ,
    GamePermissions.POSTAL_TYPES,
    GamePermissions.POSTAL_THREADS,
    GamePermissions.CHARACTER_SELECT,
    GamePermissions.CHARACTER_LIST_OWN,
    GamePermissions.CHARACTER_CREATE,
    GamePermissions.CHARACTER_DELETE,
    GamePermissions.CHARACTER_PROGRESSION_READ,
    GamePermissions.CHARACTER_PROGRESSION_MODIFY,
    GamePermissions.CHARACTER_CORPORATIONS_READ,
    GamePermissions.LOCATIONS_READ,
    GamePermissions.LOCATIONS_ENTER,
    GamePermissions.LOCATIONS_LEAVE,
    GamePermissions.LOCATIONS_CHECK_ACCESS,
    GamePermissions.LOCATIONS_LIST_OCCUPANTS,
    GamePermissions.LOCATIONS_TAG_OCCUPANT,
    GamePermissions.LOCATIONS_JOIN_WEBSOCKET,
    GamePermissions.BLOCK_NOTES_READ,
    GamePermissions.BLOCK_NOTES_WRITE,
    GamePermissions.BLOCK_NOTES_DELETE,
    GamePermissions.QUESTS_READ,
    GamePermissions.CHAT_SEND,
    GamePermissions.CHAT_WHISPER,
    GamePermissions.CHAT_OFFGAME,
    GamePermissions.CHAT_DICE,
    GamePermissions.CHAT_SOCIAL_CLASH,
    GamePermissions.CHAT_READ,
    GamePermissions.CHAT_EDIT,
    GamePermissions.MESSAGES_SEND,
    GamePermissions.MESSAGES_READ,
    GamePermissions.MESSAGES_DELETE,
    GamePermissions.POSTAL_SEND,
    GamePermissions.POSTAL_DELETE,
    GamePermissions.OFFGAME_CHAT_LIST,
    GamePermissions.OFFGAME_CHAT_CREATE,
    GamePermissions.OFFGAME_CHAT_READ,
    GamePermissions.OFFGAME_CHAT_SEND,
    GamePermissions.OFFGAME_CHAT_EDIT,
    GamePermissions.OFFGAME_CHAT_LEAVE,
    GamePermissions.OFFGAME_CHAT_TYPING,
    GamePermissions.ECONOMY_WALLET_READ,
    GamePermissions.ECONOMY_TRANSFER,
    GamePermissions.ECONOMY_TRANSACTIONS_READ,
    GamePermissions.SHOPS_LIST,
    GamePermissions.SHOPS_READ,
    GamePermissions.SHOPS_PURCHASE,
    GamePermissions.ITEMS_LIST,
    GamePermissions.ITEMS_READ,
    GamePermissions.ITEMS_SEARCH,
    GamePermissions.ITEMS_CATEGORIES,
    GamePermissions.CORPORATIONS_LIST,
    GamePermissions.CORPORATIONS_READ,
    GamePermissions.CORPORATIONS_JOIN,
    GamePermissions.CORPORATIONS_LEAVE,
    GamePermissions.CORPORATIONS_INVITATIONS_READ,
    GamePermissions.CORPORATIONS_INVITATIONS_RESPOND,
    GamePermissions.RELATIONSHIPS_LIST,
    GamePermissions.RELATIONSHIPS_TYPES,
    GamePermissions.RELATIONSHIPS_PROPOSE,
    GamePermissions.RELATIONSHIPS_RESPOND,
    GamePermissions.RELATIONSHIPS_END,
    GamePermissions.HOUSING_DISTRICTS,
    GamePermissions.HOUSING_AVAILABLE,
    GamePermissions.HOUSING_MY_PROPERTIES,
    GamePermissions.HOUSING_READ,
    GamePermissions.HOUSING_RENT,
    GamePermissions.HOUSING_PURCHASE,
    GamePermissions.HOUSING_PAY_RENT,
    GamePermissions.HOUSING_MANAGE_GUESTS,
    GamePermissions.EXPERIENCE_READ,
    GamePermissions.EXPERIENCE_STATS,
    GamePermissions.EXPERIENCE_SPEND,
    GamePermissions.OCCUPATIONS_LIST,
    GamePermissions.OCCUPATIONS_READ,
    GamePermissions.OCCUPATIONS_CATEGORIES,
    GamePermissions.OCCUPATIONS_CHECK_ELIGIBILITY,
    GamePermissions.SKILLS_LIST,
    GamePermissions.SKILLS_READ,
    GamePermissions.SKILLS_CATEGORIES,
    GamePermissions.SKILLS_PLACEHOLDERS,
    GamePermissions.SKILLS_PROBABILITIES,
    GamePermissions.SESSION_INIT,
    GamePermissions.SESSION_CURRENT,
    GamePermissions.SESSION_ACTIVE,
    GamePermissions.SESSION_HISTORY,
    GamePermissions.SESSION_INVALIDATE,
    GamePermissions.SESSION_INVALIDATE_OTHERS,
    GamePermissions.TYPING_SEND,
    GamePermissions.STATUS_READ,
    GamePermissions.EVENTS_REPLAY,
    GamePermissions.EVENTS_LATEST,
    GamePermissions.MODERATION_REPORT_SEND,
    GamePermissions.MODERATION_REPORT_READ_OWN,
    GamePermissions.MODERATION_ACTIONS_READ_OWN,
    GamePermissions.MODERATION_APPEAL_SEND,
    GamePermissions.MODERATION_CHECK_CHAT_STATUS,
  ],

  /**
   * Master - Game Master with moderation and admin powers (inherits all player permissions)
   */
  master: [
    GamePermissions.CHARACTER_READ_OTHERS_PRIVATE,
    GamePermissions.CHAT_DELETE,
    GamePermissions.CHAT_MASTER_ACTION,
    GamePermissions.CHAT_USE_FAKE_PNG,  // PNG Light masking
    GamePermissions.CHAT_SOCIAL_CONFLICTS,
    GamePermissions.QUESTS_CREATE,
    GamePermissions.QUESTS_START,
    GamePermissions.QUESTS_END,
    GamePermissions.QUESTS_ACTION_MODE,
    GamePermissions.QUESTS_REVEAL_ACTIONS,
    GamePermissions.LOCATIONS_GRANT_ACCESS,
    GamePermissions.MODERATION_CHAT_CLEAR,
    GamePermissions.ADMIN_SHOPS_RESTOCK,
    GamePermissions.ADMIN_ECONOMY_GRANT,
    GamePermissions.ADMIN_ECONOMY_RESET_CREDIT,
    GamePermissions.ADMIN_ECONOMY_STATUS,
    GamePermissions.ADMIN_EXPERIENCE_GRANT,
    GamePermissions.ADMIN_TIME_ADVANCE,
  ],

  /**
   * Moderatore - Content moderation powers (inherits all player permissions)
   */
  moderatore: [
    GamePermissions.CHAT_DELETE,
    GamePermissions.CHAT_MODERATION_ACTION,
    GamePermissions.MODERATION_CHAT_CLEAR,
    GamePermissions.MODERATION_REPORT_READ_ALL,
    GamePermissions.MODERATION_ACTIONS_CREATE,
    GamePermissions.MODERATION_ACTIONS_READ_ALL,
  ],
};

/**
 * Status restrictions (draft/pending block certain permissions - foundational game rules)
 */
export const StatusRestrictions: Record<string, GamePermission[]> = {
  draft: [
    GamePermissions.CHAT_SEND,
    GamePermissions.POSTAL_SEND,
    GamePermissions.SHOPS_LIST,
    GamePermissions.SHOPS_READ,
    GamePermissions.SHOPS_PURCHASE,
    GamePermissions.ECONOMY_TRANSFER,
  ],
  pending: [
    GamePermissions.CHAT_SEND,
    GamePermissions.POSTAL_SEND,
    GamePermissions.SHOPS_LIST,
    GamePermissions.SHOPS_READ,
    GamePermissions.SHOPS_PURCHASE,
    GamePermissions.ECONOMY_TRANSFER,
  ],
};

/**
 * Resolve permissions for a gameplay role (including inheritance)
 */
function resolveGameplayRolePermissions(roleName: string): GamePermission[] {
  const permissions = new Set<GamePermission>();

  // All roles inherit player permissions
  if (roleName === 'master' || roleName === 'moderatore') {
    GameRolePermissions.player.forEach(p => permissions.add(p));
  }

  // Add role-specific permissions
  const rolePerms = GameRolePermissions[roleName] || [];
  rolePerms.forEach(p => permissions.add(p));

  return Array.from(permissions);
}

/**
 * Check if character has specific game permission
 *
 * Resolution order:
 * 1. isGestore = true → GRANT ALL
 * 2. Status restrictions FIRST (foundational game rules, cannot be overridden)
 * 3. characterPermissions: "-permission" → DENY, "permission" or "game:*" → GRANT
 * 4. gameplayRoles (player, master, moderatore) → GRANT if role has permission
 * 5. Default → DENY
 *
 * @param permission - Permission to check
 * @param playerStatus - Character status (draft, pending, approved)
 * @param isGestore - Gestore bypass flag
 * @param gameplayRoles - Character's gameplay roles (player, master, moderatore)
 * @param characterPermissions - Character-level permission overrides
 */
export function hasGamePermission(
  permission: GamePermission,
  playerStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): boolean {
  if (isGestore) return true;

  // Status restrictions FIRST (foundational game rules)
  const blockedPerms = StatusRestrictions[playerStatus] || [];
  if (blockedPerms.includes(permission)) return false;

  // Explicit deny
  if (characterPermissions.includes(`-${permission}`)) return false;

  // Explicit grant or wildcard
  if (characterPermissions.includes(permission) || characterPermissions.includes('game:*')) {
    return true;
  }

  // Role-based
  const roles = gameplayRoles.length > 0 ? gameplayRoles : ['player'];
  for (const roleName of roles) {
    const rolePermissions = resolveGameplayRolePermissions(roleName);
    if (rolePermissions.includes(permission)) return true;
  }

  return false;
}

/**
 * Get all game permissions for a character
 * Used by session endpoint to send full permission list to frontend
 *
 * @param playerStatus - Character status (draft, pending, approved)
 * @param isGestore - Gestore bypass flag
 * @param gameplayRoles - Character's gameplay roles
 * @param characterPermissions - Character-level permission overrides
 */
export function getCharacterGamePermissions(
  playerStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): GamePermission[] {
  // Gestore has all permissions
  if (isGestore) return Object.values(GamePermissions);

  const allPermissions = new Set<GamePermission>();
  const roles = gameplayRoles.length > 0 ? gameplayRoles : ['player'];

  // Collect role permissions
  for (const roleName of roles) {
    resolveGameplayRolePermissions(roleName).forEach(p => allPermissions.add(p));
  }

  // Remove status-blocked permissions
  const blockedPerms = StatusRestrictions[playerStatus] || [];
  blockedPerms.forEach(blocked => allPermissions.delete(blocked));

  // Apply character-level overrides
  characterPermissions.forEach(p => {
    if (p.startsWith('-')) allPermissions.delete(p.slice(1) as GamePermission);
    else if (p !== 'game:*') allPermissions.add(p as GamePermission);
  });

  return Array.from(allPermissions).sort();
}

/**
 * Check if character can read other characters' private data (master-only permission)
 * Extracted helper to avoid inline duplication in CharacterController
 *
 * @param playerStatus - Character status
 * @param isGestore - Gestore bypass flag
 * @param gameplayRoles - Character's gameplay roles
 * @param characterPermissions - Character-level permission overrides
 */
export function canReadOthersPrivate(
  playerStatus: string,
  isGestore: boolean,
  gameplayRoles: string[],
  characterPermissions: string[]
): boolean {
  return hasGamePermission(
    GamePermissions.CHARACTER_READ_OTHERS_PRIVATE,
    playerStatus,
    isGestore,
    gameplayRoles,
    characterPermissions
  );
}
