// Game Backend Types

import type { PaginationInfo } from '@shared/types/responses';

/**
 * Error details type for API responses
 */
export interface ErrorDetails {
  [key: string]: unknown;
  field?: string;
  expectedType?: string;
  receivedValue?: unknown;
  receivedType?: string;
  validationErrors?: Array<{ field: string; message: string; value?: unknown }>;
  affectedFields?: string[];
  duplicateField?: string;
  duplicateValue?: unknown;
  existingUserId?: string;
  providedId?: string;
  expectedFormat?: string;
  allowedFields?: string[];
  receivedFields?: string[];
  allowedValues?: string[];
  providedDuration?: string;
  invalidScopes?: string[];
  validScopes?: string[];
  availableScopes?: string[];
  searchedUserId?: string;
  requestedUserId?: string;
  searchPerformed?: boolean;
  errorType?: string;
  retryable?: boolean;
  operation?: string;
  userId?: string;
  mongoErrorCode?: number;
  indexName?: string;
}

/**
 * @deprecated Use PaginationInfo from @shared/types/responses instead
 * Re-export for backward compatibility
 */
export type { PaginationInfo } from '@shared/types/responses';

/**
 * Standardized API Response interface
 */
export interface ApiResponse<T = any> {
  result: boolean;           // Standard: true/false
  success?: boolean;         // Optional: backward compat (mirrors result)
  data?: T;                  // Single record data or metadata object
  list?: T[];                // Array for list responses (alternative to data.list)
  pagination?: PaginationInfo; // Pagination info for list responses
  message?: string;          // Optional message for POST/PATCH/DELETE
  error?: string;            // Error message if result = false
  code?: string;             // Error code (e.g., 'USER_NOT_FOUND')
  details?: ErrorDetails;    // Additional error details (typed instead of any)
  timestamp: string;         // Always present
  requestId?: string;        // Optional for request tracing
}

// Authentication Types (from cookies) - Updated to use granular permission system
// Re-export shared auth types with aliases for backward compatibility
import { AuthToken, CharacterContextToken } from '@shared/types';
export type AuthUser = AuthToken;
export type CharacterContext = CharacterContextToken;

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  character?: CharacterContext;
}

// Game Action Types
export type ChatActionType = 
  | 'standard' 
  | 'master' 
  | 'moderation' 
  | 'whisper' 
  | 'ooc' 
  | 'dice_generic' 
  | 'dice_action' 
  | 'item_usage';

export type MessageVisibility = 'public' | 'whisper' | 'master_only';

export interface ChatMessage {
  id: string;
  actionType: ChatActionType;
  characterId: string;
  characterName: string;
  content: string;
  locationId: string;
  timestamp: Date;
  visibility: MessageVisibility;
  diceResult?: DiceResult;
  itemEffect?: ItemEffect;
  targetCharacters?: string[]; // For whispers
  characterRoles: string[]; // Sender's gameplay roles
}

// Dice System
export interface DiceRoll {
  skill?: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  modifier?: number;
  reason?: string;
}

export interface DiceResult {
  dice: string;
  result: number;
  skillValue: number;
  modifier: number;
  finalTarget: number;
  success: boolean;
  level: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
  description: string;
}

// Item System
export interface ItemUsage {
  inventoryItemId: string;
  target?: string;
  context?: string;
}

export interface ItemEffect {
  description: string;
  skillBonuses?: Record<string, {
    bonus: number;
    duration: 'this_action' | 'next_roll' | 'permanent' | string;
  }>;
  specialEffects?: string[];
}

export interface ItemConsumption {
  directConsumption?: {
    itemConsumed: string;
    quantityConsumed: number;
    remainingQuantity: number;
  };
  indirectConsumption?: {
    mainItem: string;
    consumedItems: Array<{
      itemId: string;
      quantityBefore: number;
      quantityConsumed: number;
      quantityAfter: number;
    }>;
  };
}

// Economy Types
export interface Wallet {
  characterId: string;
  cash: number; // pence
  deposit: number; // pence in bank
  formatted: {
    cash: string;
    deposit: string;
    total: string;
  };
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: 'cash' | 'bank_transfer';
  reason?: string;
  timestamp: Date;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number; // pence
  priceFormatted: string;
  inStock: boolean;
  currentStock: number;
  maxStock: number;
  requirements: {
    skills?: Array<{ skill: string; minimum: number }>;
    occupations?: string[];
    corporations?: string[];
  };
  canPurchase: boolean;
}

// Location Types
export interface LocationSettings {
  visible: boolean;
  chat: boolean;
  shop: boolean;
  private: boolean;
}

export interface LocationOccupant {
  characterId: string;
  characterName: string;
  lastSeen: Date;
  roles: string[];
}

export interface Location {
  id: string;
  name: string;
  description: string;
  district: string;
  settings: LocationSettings;
  occupants: LocationOccupant[];
  availableItems?: ShopItem[];
  npcs?: NPC[];
  parentId?: string;
  children?: Location[];
}

// NPC System
export interface NPC {
  id: string;
  name: string;
  description: string;
  occupation: string;
  mood: string;
  memoryOfCharacter: 'positive' | 'neutral' | 'negative';
  lastInteraction?: Date;
  isEligibleForActivation: boolean;
  isActive?: boolean;
}

export interface NPCTurnAnalysis {
  locationId: string;
  isNpcTurn: boolean;
  lastNpcMessage?: {
    npcId: string;
    npcName: string;
    messageId: string;
    sentAt: Date;
    content: string;
  };
  activeCharacters: Array<{
    characterId: string;
    characterName: string;
    lastMessageAfterNpc?: {
      messageId: string;
      sentAt: Date;
      content: string;
    };
    hasResponded: boolean;
  }>;
  waitingFor: Array<{
    characterId: string;
    characterName: string;
    expectedResponseBy: Date;
  }>;
  npcActivation: {
    readyForActivation: boolean;
    estimatedActivationTime: Date;
    selectedNpc: {
      id: string;
      name: string;
      selectionConfidence: number;
      selectionReason: string;
    };
  };
}

// Corporation System
export interface Corporation {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automatic' | 'mixed';
  membershipType: 'manual' | 'automatic';
  requirements?: {
    automatic?: Array<{
      skill?: string;
      minimum?: number;
      item?: string;
      required?: boolean;
    }>;
    minimumStats?: Record<string, number>;
    requiredSkills?: Record<string, number>;
    socialClass?: string[];
  };
  members: Array<{
    characterId: string;
    characterName: string;
    role: string;
    joinedAt: Date;
  }>;
  locations: string[];
  treasury?: number;
  monthlyDues?: number;
  isRecruiting?: boolean;
  memberCount?: number;
  influence?: string;
}

export interface MembershipRequest {
  id: string;
  corporationId: string;
  corporationName: string;
  applicant: {
    characterId: string;
    characterName: string;
    occupation: string;
    socialClass: string;
  };
  message: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  meetsRequirements: boolean;
  requirementIssues: string[];
  reviewedAt?: Date;
  reviewedBy?: string;
  responseMessage?: string;
  assignedRoleId?: string;
}

// Messaging System
export interface InGameMessage {
  id: string;
  type: 'letter' | 'telegram' | 'postcard' | 'invitation';
  fromCharacterId: string;
  fromCharacterName: string;
  toCharacterIds: string[];
  subject: string;
  content: string;
  priority: 'urgent' | 'normal' | 'low';
  sealed: boolean;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  status: 'posted' | 'delivered' | 'read';
  letterhead?: string;
  seal?: {
    type: string;
    design: string;
    color: string;
  };
  postmark?: {
    origin: string;
    timestamp: Date;
  };
}

export interface MessageFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  messageCount: number;
  unreadCount: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface MessageLabel {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  isDefault: boolean;
  createdAt: Date;
}

// OOC Chat System
export interface OffGameChat {
  id: string;
  type: 'direct' | 'group';
  name?: string; // For groups
  description?: string; // For groups
  participants: Array<{
    userId: string;
    username: string;
    displayName?: string;
    role: 'admin' | 'member';
    joinedAt: Date;
    isActive: boolean;
    isOnline?: boolean;
    lastSeen?: Date;
  }>;
  isPrivate: boolean;
  maxMembers: number;
  createdBy: string;
  createdAt: Date;
  lastMessage?: {
    content: string;
    sentAt: Date;
    fromMe?: boolean;
    fromUsername?: string;
    isRead?: boolean;
  };
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

export interface OffGameMessage {
  id: string;
  chatId: string;
  chatType: 'direct' | 'group';
  fromUserId: string;
  fromUsername: string;
  fromDisplayName?: string;
  content: string;
  messageType: 'text' | 'system';
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  replyToMessageId?: string;
  replyToContent?: string;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  sentAt: Date;
  updatedAt: Date;
}

// Relationship System
export interface Relationship {
  id: string;
  type: string;
  withCharacter: {
    id: string;
    name: string;
  };
  status: 'pending' | 'active' | 'declined';
  mutual: boolean;
  strength: number; // 0-100
  notes?: string;
  establishedAt: Date;
}

// Character System
export interface Character {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  occupation: string;
  socialClass: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  stats: Record<string, number>;
  skills: Record<string, number>;
  walletId: string;
  inventoryId: string;
  currentLocation: string;
  relationships: Relationship[];
  corporations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  gameplayRoles: string[];
  isActive: boolean;
  avatar?: string;
  prestavolto?: string;
  background?: string;
  description?: string;
  equipment?: string[];
  createdAt: Date;
  submittedAt?: Date;
  lastActive?: Date;
}

// Inventory System
export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  quantity: number;
  acquiredAt: Date;
  acquiredFrom: string;
}

export interface Inventory {
  characterId: string;
  items: InventoryItem[];
  totalItems: number;
  maxCapacity: number;
}

// WebSocket Event Types
export interface SocketChatMessage extends ChatMessage {
  broadcastTo: string[];
}

export interface SocketLocationOccupancy {
  locationId: string;
  occupants: Array<{
    characterId: string;
    characterName: string;
    roles: string[];
  }>;
}

// Redis Event Types
export interface RedisEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}