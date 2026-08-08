/**
 * DTO Types for Chat Message Transformation
 *
 * Defines the enriched API response format for chat messages.
 * Follows LocationService pattern - typed DTOs separate from DB models.
 *
 * @module transformers/types
 * @since 2.2.0
 */

/**
 * Enriched chat message for API responses
 * Base fields + type-specific enriched data
 */
export interface EnrichedChatMessage {
  // Base fields (all action types)
  _id: string;
  actionType: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  position?: string;
  locationId: string;
  content: string;
  timestamp: string; // ISO format
  visibility: 'public' | 'whisper' | 'master_only';

  // Type-specific enriched data
  diceResult?: EnrichedDiceResult;
  skillCheck?: EnrichedSkillCheck;
  statCheck?: EnrichedStatCheck;
  itemEffect?: EnrichedItemEffect;
  whisper?: EnrichedWhisper;
  socialConflict?: EnrichedSocialConflict;
  confrontation?: EnrichedConfrontation;

  // Raw whisper/master_only target IDs (client re-derives its own visibility
  // check from this - see targetCharacters handling in MessageTransformer.transform)
  targetCharacters?: string[];

  // Optional metadata
  editHistory?: Array<{
    content: string;
    editedAt: string;
    editedBy: string;
  }>;
  hiddenContent?: string;
}

/**
 * Base dice roll result
 */
export interface EnrichedDiceResult {
  dice: string; // "2d6+3"
  result: number; // Sum before modifier
  rolls?: number[]; // Individual die results
  modifier?: number; // +/- modifier
  total: number; // Final result
}

/**
 * Skill check with enriched skill name
 */
export interface EnrichedSkillCheck extends EnrichedDiceResult {
  skillId: string;
  skillName: string; // ← ENRICHED from Skill.findById
  success: boolean;
  successDegree: string; // BRP system: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble'
}

/**
 * Stat check with stat name
 */
export interface EnrichedStatCheck extends EnrichedDiceResult {
  statName: string;
  success: boolean;
  successDegree: string;
}

/**
 * Item use with enriched item details
 */
export interface EnrichedItemEffect {
  itemId: string;
  itemName: string; // ← ENRICHED from Item.findById
  itemDescription?: string; // ← ENRICHED
  itemImageUrl?: string; // ← ENRICHED
  description: string;
  consumedItems?: Array<{
    itemId: string;
    itemName: string; // ← ENRICHED
    quantity: number;
  }>;
  effects?: Array<{
    type: string;
    value: number;
    duration?: string;
  }>;
}

/**
 * Whisper with enriched target character names
 */
export interface EnrichedWhisper {
  targetCharacterIds: string[];
  targetCharacterNames: string[]; // ← ENRICHED from Character.find
}

/**
 * Social conflict result
 */
export interface EnrichedSocialConflict {
  type: string;
  attackerSkill: string;
  defenderSkill: string;
  attackerRoll: number;
  defenderRoll: number;
  result: string;
  attackerSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  defenderSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  messageForDefender?: string;
  visibleToDefenderOnly?: boolean;
}

/**
 * TiroContrapposto (unified confrontation) result — social + combat.
 * Mirrors IChat.confrontation (database/models/Chat.ts). Result-revealing fields
 * (attackRoll/defenseRoll/successLevels/outcome/defenseSkill) are stripped by
 * MessageTransformer for the attacker when hiddenResultForAttacker is true —
 * see maskConfrontationForViewer().
 */
export interface EnrichedConfrontation {
  type: 'social' | 'combat';
  encounterId?: string;
  turnNumber?: number;
  phase: 'rolling_initiative' | 'waiting_reaction' | 'result';

  initiativeRolls?: { [characterId: string]: { roll: number; successDegree: string } };
  firstAttacker?: string;

  constitutionCheckRequired?: boolean;
  constitutionCheckPassed?: boolean;
  constitutionCheckRoll?: number;

  hiddenResultForAttacker?: boolean;
  visibleToAttackerOnly?: boolean;

  attackerCharacterId: string;
  defenderCharacterId: string;

  availableDefenseSkills?: Array<{
    skillName: string;
    label: string;
    specialRule?: string;
    value?: number;
  }>;

  attackSkill?: string;
  defenseSkill?: string;
  weaponName?: string;
  attackRoll?: number;
  defenseRoll?: number;
  attackSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  defenseSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

  outcome?: 'hit' | 'miss' | 'parry' | 'dodge' | 'disarm' | 'attacker_wins' | 'defender_wins' | 'draw';

  damageDealt?: number;
  isCriticalDamage?: boolean;
  damageFormula?: string;

  messageForDefender?: string;
  visibleToDefenderOnly?: boolean;
}

/**
 * Parameters for ChatMessageService.getMessages()
 */
export interface GetMessagesParams {
  locationId: string;
  characterId: string;
  timeThreshold?: Date;
  limit?: number;
  offset?: number;
}
