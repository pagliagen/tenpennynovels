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
  socialConflict?: any; // TODO: type this properly

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
 * Parameters for ChatMessageService.getMessages()
 */
export interface GetMessagesParams {
  locationId: string;
  characterId: string;
  timeThreshold?: Date;
  limit?: number;
}

/**
 * Parameters for ChatMessageService.createMessage()
 */
export interface CreateMessageParams {
  actionType: string;
  content: string;
  locationId: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  isMasked: boolean;
  realCharacterName?: string;
  visibility?: 'public' | 'whisper' | 'master_only';
  targetCharacters?: string[];
  diceSpec?: string;
  skillId?: string;
  statName?: string;
  itemId?: string;
  position?: string;
  isHidden?: boolean;
  sessionId?: string;
  characterRoles: string[];
}
