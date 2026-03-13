/**
 * Chat Types
 *
 * Frontend types for the location chat system.
 * Supports 8 message types: standard, whisper, ooc, dice_roll, skill_check, stat_check, item_use, master.
 *
 * @module types/chat
 * @since 2.0.0
 */

/**
 * Action Type Enum (MongoDB field name)
 *
 * Defines all possible action types in location chat.
 * **Note**: Renamed from ChatMessageType to match DB schema.
 */
export type ActionType =
  | 'standard'      // Normal in-character message
  | 'whisper'       // Private message (only sender + target + master see)
  | 'ooc'           // Out-of-character message
  | 'dice_roll'     // Dice roll result
  | 'skill_check'   // Social conflict / skill check result
  | 'stat_check'    // Attribute check result
  | 'item_use'      // Item usage action
  | 'master'        // Master-only announcement
  | 'moderation';   // System/moderation message

// Backward compatibility alias
export type ChatMessageType = ActionType;

/**
 * Dice Roll Payload
 * Sistema percentuale: solo 1d100, mostra risultato/100
 */
export interface DiceRollPayload {
  result: number;          // Risultato 1d100 (1-100)
}

/**
 * Skill Check Payload (Social Conflicts)
 */
export interface SkillCheckPayload {
  skill: string;                    // e.g., "Raggirare", "Persuadere"
  targetCharacterId: string;
  targetCharacterName: string;
  intent: string;                   // What the character is trying to achieve
  lieText?: string;                 // Only for Raggirare (lie detection)
  success: boolean;                 // Overall success/failure
  results: SkillCheckResult[];      // Per-target results
}

/**
 * Individual Skill Check Result (for multi-target checks)
 */
export interface SkillCheckResult {
  characterId: string;
  characterName: string;
  passed: boolean;           // Did this character pass the check?
  roll: number;              // Dice roll result
  difficulty: number;        // Target difficulty
}

/**
 * Stat Check Payload
 */
export interface StatCheckPayload {
  attribute: string;         // e.g., "Strength", "Dexterity"
  difficulty: string;        // e.g., "Easy", "Moderate", "Hard"
  roll: number;
  target: number;
  success: boolean;
}

/**
 * Item Use Payload
 */
export interface ItemUsePayload {
  itemId: string;
  itemName: string;
  itemDescription?: string;
  targetCharacterId?: string;  // If using item on another character
  targetCharacterName?: string;
}

/**
 * Whisper Visibility
 *
 * Controls who can see a whisper message.
 */
export interface WhisperVisibility {
  senderId: string;
  targetId: string;
  canSee: string[];  // Character IDs who can see this message (sender, target, master)
}

/**
 * Chat Message (Core Type)
 *
 * Represents a single message in location chat.
 * **Note**: Field names match MongoDB schema exactly (no mapping).
 */
export interface ChatMessage {
  // Identity
  _id: string;
  actionType: ActionType;  // DB field (was messageType)

  // Author
  characterId: string;
  characterName: string;
  tags?: string;           // DB field (was characterTag) - Single string, NOT array

  // Location
  locationId: string;

  // Content
  content: string;         // DB field (was text)

  // Type-specific payload (DB field names)
  diceResult?: DiceRollPayload;        // DB field (was diceRoll)
  socialConflict?: SkillCheckPayload;  // DB field (was skillCheck)
  statCheck?: StatCheckPayload;
  itemEffect?: ItemUsePayload;         // DB field (was itemUse)
  targetCharacters?: string[];         // DB field (was whisperVisibility) - Array of character IDs

  // Hidden/Defender-only fields
  hiddenContent?: string;
  visibleToDefenderOnly?: boolean;

  // Metadata
  editHistory?: Array<{               // DB field (replaces isEdited/editedAt)
    content: string;
    editedAt: Date;
    editedBy: string;
  }>;
  timestamp: string;                  // DB field (replaces createdAt/updatedAt)
}

/**
 * Chat Store State
 *
 * Zustand store state for location chat.
 */
export interface ChatStoreState {
  // Messages
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Current location
  locationSlug: string | null;
  locationId: string | null;

  // Occupants (real-time presence)
  occupants: ChatOccupant[];

  // User's current tag (sub-chat position)
  currentTag: string | null;

  // Typing indicators
  typingUsers: Map<string, boolean>;  // characterId -> isTyping
}

/**
 * Chat Occupant (simplified from LocationOccupant)
 *
 * Represents a character present in the chat.
 */
export interface ChatOccupant {
  characterId: string;
  characterName: string;
  currentTag?: string;
  isActive: boolean;
  isMaster?: boolean;      // Is this user a game master?
}

/**
 * Chat API Request Types
 */

/**
 * Send Message Request (MongoDB field names)
 */
export interface SendMessageRequest {
  actionType: ActionType;          // DB field (was messageType)
  content: string;                 // DB field (was text)
  tags?: string;                   // DB field - Position tag (e.g., "Tavolo 1")
  targetCharacterId?: string;      // For whispers (backend converts to targetCharacters array)
  targetCharacters?: string[];     // For whispers (backend expects array)
  diceSpec?: string;               // For dice_roll (sempre '1d100')
  skillId?: string;                // For skill_check (ObjectId - backend does secure lookup)
  statName?: string;               // For stat_check
  targetValue?: number;            // Target value for checks
  itemId?: string;                 // For item_use
  skillCheck?: Omit<SkillCheckPayload, 'results' | 'success'>;  // Backend calculates results
  statCheck?: Omit<StatCheckPayload, 'roll' | 'success'>;       // Backend rolls dice
  itemUse?: ItemUsePayload;
}

/**
 * Edit Message Request
 */
export interface EditMessageRequest {
  text: string;
}

/**
 * Chat API Response Types
 */

/**
 * Message History Response
 */
export interface MessageHistoryResponse {
  messages: ChatMessage[];
  totalCount: number;
  hasMore: boolean;        // Are there older messages to load?
}

/**
 * Send Message Response (Backend wrapper structure)
 */
export interface SendMessageResponse {
  result: boolean;
  data: {
    action: ChatMessage;
  };
  message: string;  // Success message (e.g., "Record creato con successo")
  timestamp: string;
}

/**
 * WebSocket Event Payloads
 */

/**
 * Location Message Notification (WebSocket event)
 *
 * Emitted when a new message is posted in a location.
 */
export interface LocationMessageNotification {
  message: ChatMessage;
  locationId: string;
}

/**
 * User Typing Event (WebSocket event)
 *
 * Emitted when a user starts/stops typing.
 */
export interface UserTypingEvent {
  characterId: string;
  characterName: string;
  locationId: string;
  isTyping: boolean;
}

/**
 * Permission Gate Props
 *
 * Props for components that check character permissions.
 */
export interface ChatPermissionGateProps {
  characterStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Tag Selector Option
 *
 * Available tags for sub-chat positions.
 */
export interface TagOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Preset Tags
 *
 * Common tags used in location chats.
 */
export const PRESET_TAGS: TagOption[] = [
  { value: 'tavolo-1', label: 'Tavolo 1', description: 'Primo tavolo' },
  { value: 'tavolo-2', label: 'Tavolo 2', description: 'Secondo tavolo' },
  { value: 'tavolo-3', label: 'Tavolo 3', description: 'Terzo tavolo' },
  { value: 'bancone', label: 'Bancone', description: 'Al bancone' },
  { value: 'entrata', label: 'Entrata', description: 'Vicino all\'entrata' },
  { value: 'angolo', label: 'Angolo', description: 'In un angolo' },
  { value: 'centro', label: 'Centro', description: 'Centro della stanza' },
];

/**
 * Message Edit Window (3 minutes)
 */
export const MESSAGE_EDIT_WINDOW_MS = 3 * 60 * 1000;

/**
 * Can Edit Message Helper
 *
 * Checks if a message can be edited/deleted.
 *
 * @param message - Message to check
 * @param currentCharacterId - ID of current character
 * @returns true if message can be edited
 */
export function canEditMessage(
  message: ChatMessage,
  currentCharacterId: string
): boolean {
  // Must be own message
  if (message.characterId !== currentCharacterId) {
    return false;
  }

  // Check time window
  const now = Date.now();
  const createdAt = new Date(message.timestamp).getTime();  // Updated: timestamp (was createdAt)
  const elapsed = now - createdAt;

  return elapsed < MESSAGE_EDIT_WINDOW_MS;
}

/**
 * Can See Message Helper
 *
 * Checks if a character can see a message (handles whisper visibility).
 *
 * @param message - Message to check
 * @param characterId - ID of character viewing
 * @param isMaster - Is viewer a game master?
 * @returns true if character can see message
 */
export function canSeeMessage(
  message: ChatMessage,
  characterId: string,
  isMaster: boolean
): boolean {
  // Non-whisper messages are always visible
  if (message.actionType !== 'whisper') {  // Updated: actionType (was messageType)
    return true;
  }

  // Masters see everything
  if (isMaster) {
    return true;
  }

  // Check whisper visibility (targetCharacters array)
  const targetCharacters = message.targetCharacters;  // Updated: targetCharacters (was whisperVisibility)
  if (!targetCharacters || targetCharacters.length === 0) {
    return false;
  }

  // Character can see if they are sender or in targetCharacters
  return message.characterId === characterId || targetCharacters.includes(characterId);
}
