/**
 * Action Types and Interfaces
 *
 * Core types for the modular action handler system.
 * Defines contracts between ChatController and action handlers.
 *
 * @module actions/types
 * @since 2.1.0
 */

import type { DiceService } from '../services/DiceService';
import type { CharacterSkillService } from '../services/CharacterSkillService';

/**
 * Action types supported by the chat system
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

/**
 * Input data for action creation
 * Extracted from Express Request and passed to handlers
 */
export interface ActionInput {
  actionType: ChatActionType | string;
  content: string;
  locationId: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  isMasked: boolean;
  realCharacterName?: string;

  // Optional fields (depending on action type)
  visibility?: 'public' | 'whisper' | 'master_only';
  targetCharacters?: string[];
  diceSpec?: string;
  skillId?: string;
  statName?: string;
  itemId?: string;
  position?: string;
  isHidden?: boolean;

  // For social conflicts and combat
  defenderCharacterId?: string;
  attackerSkill?: string;
  defenseSkill?: string;
  weaponId?: string;
  lieText?: string;
  encounterId?: string;

  // Metadata
  sessionId?: string;
  characterRoles: string[];
}

/**
 * Output data structure returned by handlers
 * This gets saved to MongoDB as IChat document
 */
export interface ActionData {
  actionType: string;
  characterId: string;
  characterName: string;
  characterSurname?: string;
  characterAvatar?: string;
  isBot: boolean;
  isMasked: boolean;
  realCharacterName?: string;
  content: string;
  locationId: string;
  locationName?: string;
  sessionId?: string;
  timestamp: Date;
  visibility: 'public' | 'whisper' | 'master_only';
  characterRoles: string[];
  position?: string;
  isHidden?: boolean;

  // Type-specific fields (optional)
  targetCharacters?: string[];
  diceResult?: {
    dice: string;
    result: number;
    rolls?: number[];
    modifier?: number;
    total: number;
    success?: boolean;
    successDegree?: string;
    skillId?: string;
    skillName?: string;
    statName?: string;
  };
  itemEffect?: {
    itemId: string;
    itemName: string;
    description: string;
    consumedItems?: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
    }>;
    effects?: Array<{
      type: string;
      value: number;
      duration?: string;
    }>;
  };
  socialConflict?: any;
  confrontation?: any;
  successDegree?: string;
  hiddenContent?: string;
  visibleToDefenderOnly?: boolean;
  editHistory?: Array<{
    content: string;
    editedAt: Date;
    editedBy: string;
  }>;
}

/**
 * Validation result from handler validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: {
    message: string;
    code: string;
    statusCode: number;
  };
}

/**
 * Base interface for action handlers
 */
export interface IActionHandler {
  /**
   * Get the action type this handler processes
   */
  getActionType(): ChatActionType;

  /**
   * Validate input data for this action type
   * @returns ValidationResult with error details if invalid
   */
  validate(input: ActionInput, context: ActionContext): Promise<ValidationResult>;

  /**
   * Process the action and return data to save to DB
   * @returns ActionData object ready for MongoDB
   */
  process(input: ActionInput, context: ActionContext): Promise<ActionData>;
}

/**
 * Context provided to action handlers
 * Contains services, utilities, models, and request metadata
 */
export interface ActionContext {
  // Services
  diceService: DiceService;
  characterSkillService: CharacterSkillService;

  // Database models (from @database/models)
  Character: any;
  Chat: any;
  Location: any;
  Skill: any;
  Item: any;
  SkillConfrontation: any;
  CombatEncounter: any;
  GamingSession: any;

  // Utilities
  calculateSuccessDegree: any;
  getSuccessDegreeLabel: any;
  calculateSocialConflict: any;
  getDefensiveSkill?: any;

  // Request metadata
  requestId: string;
  logger: any;
}
