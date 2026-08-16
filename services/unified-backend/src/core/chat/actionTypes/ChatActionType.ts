/**
 * Fonte unica dei 12 actionType della chat di location. Prima di questo
 * file esistevano 3 copie manuali indipendenti (modules/game/actions/types.ts,
 * lo schema di core/chat/models/Chat.ts, e una terza morta in
 * modules/game/websocket/chatHandlers.ts) — consolidate qui.
 */
export enum ChatActionType {
  STANDARD = 'standard',
  WHISPER = 'whisper',
  OOC = 'ooc',
  DICE_ROLL = 'dice_roll',
  SKILL_CHECK = 'skill_check',
  STAT_CHECK = 'stat_check',
  ITEM_USE = 'item_use',
  MASTER = 'master',
  MODERATION = 'moderation',
  SOCIAL_CONFRONTATION = 'social_confrontation',
  COMBAT_ACTION = 'combat_action',
  CONFRONTATION_REACTION_REQUEST = 'confrontation_reaction_request'
}
