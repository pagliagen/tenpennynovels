// Game Backend Types

// TODO: Import from shared package when workspace configuration is complete

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
 * Pagination information for list responses
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  // Additional common aliases (backend may use either naming convention)
  currentPage?: number;
  limit?: number;
  totalItems?: number;
  hasMore?: boolean;
}

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
export type LocationActionType = 
  | 'standard' 
  | 'master' 
  | 'moderation' 
  | 'whisper' 
  | 'ooc' 
  | 'dice_generic' 
  | 'dice_action' 
  | 'item_usage';

export type MessageVisibility = 'public' | 'whisper' | 'master_only';

export interface LocationAction {
  id: string;
  actionType: LocationActionType;
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
export interface SocketLocationAction extends LocationAction {
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

// Ticketing System
export enum TicketStatus {
  OPEN = 'open',           // Nuovo ticket
  ASSIGNED = 'assigned',   // Staff assegnato
  IN_PROGRESS = 'in_progress', // Lavorazione attiva
  WAITING_USER = 'waiting_user', // Attesa risposta utente
  CLOSED = 'closed',       // Risolto
  REOPENED = 'reopened'    // Riaperto dal personaggio
}

export enum TicketDepartment {
  // Reparti Specializzati
  MASTER = 'master',           // Gestione gameplay, narrazione, eventi
  TECHNICAL = 'technical',     // Bug, performance, problemi tecnici
  MODERATION = 'moderation',   // Segnalazioni utenti, comportamenti
  ADMINISTRATION = 'administration', // Gestione personaggi, policy
  GENERAL = 'general'          // Supporto generale, prima categorizzazione
}

export enum TicketCategory {
  // Gestione Personaggi
  CHARACTER_SHEET_REVIEW = 'character_sheet_review',
  CHARACTER_APPROVAL = 'character_approval',
  CHARACTER_ACCESS_PROBLEM = 'character_access_problem',
  CHARACTER_STATUS_CHANGE = 'character_status_change',
  
  // Mondo di Gioco e Location
  PRIVATE_LOCATION_ACCESS = 'private_location_access',
  LOCATION_PROBLEM = 'location_problem',
  LOCATION_EVENT_CREATION = 'location_event_creation',
  NEW_LOCATION_REQUEST = 'new_location_request',
  
  // Sistemi di Comunicazione
  LOCATION_CHAT_PROBLEM = 'location_chat_problem',
  OFFGAME_CHAT_PROBLEM = 'offgame_chat_problem',
  POSTAL_SYSTEM_PROBLEM = 'postal_system_problem',
  GROUP_CHAT_REQUEST = 'group_chat_request',
  
  // Corporazioni e Organizzazioni
  CORPORATION_JOIN_REQUEST = 'corporation_join_request',
  CORPORATION_MANAGEMENT_PROBLEM = 'corporation_management_problem',
  NEW_CORPORATION_REQUEST = 'new_corporation_request',
  
  // Problemi Tecnici
  GAME_BUG_REPORT = 'game_bug_report',
  PERFORMANCE_PROBLEM = 'performance_problem',
  WEBSOCKET_PROBLEM = 'websocket_problem',
  GENERAL_SUPPORT = 'general_support',
  
  // Richieste Administrative
  INFORMATION_REQUEST = 'information_request',
  USER_REPORT = 'user_report',
  IMPROVEMENT_SUGGESTION = 'improvement_suggestion'
}

export enum TicketPriority {
  LOW = 'low',           // 5-7 giorni escalation
  MEDIUM = 'medium',     // 48h escalation  
  HIGH = 'high',         // 24h escalation
  CRITICAL = 'critical'  // 6h escalation (solo admin)
}

// Mapping Categoria → Label Italiana (basate sui sistemi TenpennyNovels)
export const TICKET_CATEGORIES = {
  // Gestione Personaggi
  [TicketCategory.CHARACTER_SHEET_REVIEW]: 'Revisione Scheda Personaggio',
  [TicketCategory.CHARACTER_APPROVAL]: 'Approvazione Personaggio',
  [TicketCategory.CHARACTER_ACCESS_PROBLEM]: 'Problema Accesso Personaggio',
  [TicketCategory.CHARACTER_STATUS_CHANGE]: 'Cambio Status Personaggio',
  
  // Mondo di Gioco e Location  
  [TicketCategory.PRIVATE_LOCATION_ACCESS]: 'Accesso Location Private',
  [TicketCategory.LOCATION_PROBLEM]: 'Problema Location',
  [TicketCategory.LOCATION_EVENT_CREATION]: 'Creazione Evento Location',
  [TicketCategory.NEW_LOCATION_REQUEST]: 'Richiesta Nuova Location',
  
  // Sistemi di Comunicazione
  [TicketCategory.LOCATION_CHAT_PROBLEM]: 'Problema Chat Location',
  [TicketCategory.OFFGAME_CHAT_PROBLEM]: 'Problema Chat Off-Game',
  [TicketCategory.POSTAL_SYSTEM_PROBLEM]: 'Problema Sistema Postale',
  [TicketCategory.GROUP_CHAT_REQUEST]: 'Richiesta Chat Gruppo',
  
  // Corporazioni e Organizzazioni
  [TicketCategory.CORPORATION_JOIN_REQUEST]: 'Richiesta Adesione Corporazione',
  [TicketCategory.CORPORATION_MANAGEMENT_PROBLEM]: 'Problema Gestione Corporazione',
  [TicketCategory.NEW_CORPORATION_REQUEST]: 'Creazione Nuova Corporazione',
  
  // Problemi Tecnici
  [TicketCategory.GAME_BUG_REPORT]: 'Bug Sistema di Gioco',
  [TicketCategory.PERFORMANCE_PROBLEM]: 'Problema Performance',
  [TicketCategory.WEBSOCKET_PROBLEM]: 'Problema WebSocket',
  [TicketCategory.GENERAL_SUPPORT]: 'Supporto Generale',
  
  // Richieste Administrative
  [TicketCategory.INFORMATION_REQUEST]: 'Richiesta Informazioni',
  [TicketCategory.USER_REPORT]: 'Segnalazione Utente',
  [TicketCategory.IMPROVEMENT_SUGGESTION]: 'Proposta Miglioramento'
} as const;

// Mapping Categoria → Reparto (routing automatico iniziale)
export const CATEGORY_DEPARTMENT_MAPPING = {
  // Reparto ADMINISTRATION
  [TicketCategory.CHARACTER_SHEET_REVIEW]: TicketDepartment.ADMINISTRATION,
  [TicketCategory.CHARACTER_APPROVAL]: TicketDepartment.ADMINISTRATION,
  [TicketCategory.CHARACTER_ACCESS_PROBLEM]: TicketDepartment.ADMINISTRATION,
  [TicketCategory.CHARACTER_STATUS_CHANGE]: TicketDepartment.ADMINISTRATION,
  
  // Reparto MASTER  
  [TicketCategory.PRIVATE_LOCATION_ACCESS]: TicketDepartment.MASTER,
  [TicketCategory.LOCATION_EVENT_CREATION]: TicketDepartment.MASTER,
  [TicketCategory.NEW_LOCATION_REQUEST]: TicketDepartment.MASTER,
  [TicketCategory.CORPORATION_JOIN_REQUEST]: TicketDepartment.MASTER,
  [TicketCategory.CORPORATION_MANAGEMENT_PROBLEM]: TicketDepartment.MASTER,
  [TicketCategory.NEW_CORPORATION_REQUEST]: TicketDepartment.MASTER,
  
  // Reparto TECHNICAL
  [TicketCategory.LOCATION_PROBLEM]: TicketDepartment.TECHNICAL,
  [TicketCategory.LOCATION_CHAT_PROBLEM]: TicketDepartment.TECHNICAL,
  [TicketCategory.OFFGAME_CHAT_PROBLEM]: TicketDepartment.TECHNICAL,
  [TicketCategory.POSTAL_SYSTEM_PROBLEM]: TicketDepartment.TECHNICAL,
  [TicketCategory.GAME_BUG_REPORT]: TicketDepartment.TECHNICAL,
  [TicketCategory.PERFORMANCE_PROBLEM]: TicketDepartment.TECHNICAL,
  [TicketCategory.WEBSOCKET_PROBLEM]: TicketDepartment.TECHNICAL,
  
  // Reparto MODERATION
  [TicketCategory.USER_REPORT]: TicketDepartment.MODERATION,
  
  // Reparto GENERAL (catch-all)
  [TicketCategory.GROUP_CHAT_REQUEST]: TicketDepartment.GENERAL,
  [TicketCategory.GENERAL_SUPPORT]: TicketDepartment.GENERAL,
  [TicketCategory.INFORMATION_REQUEST]: TicketDepartment.GENERAL,
  [TicketCategory.IMPROVEMENT_SUGGESTION]: TicketDepartment.GENERAL
} as const;

// Mapping Reparto → Ruoli Staff Autorizzati
export const DEPARTMENT_ROLES_MAPPING = {
  [TicketDepartment.MASTER]: ['master', 'amministratore'],
  [TicketDepartment.TECHNICAL]: ['amministratore'], // Solo admin per problemi tecnici
  [TicketDepartment.MODERATION]: ['moderatore', 'amministratore'], 
  [TicketDepartment.ADMINISTRATION]: ['master', 'moderatore', 'amministratore'],
  [TicketDepartment.GENERAL]: ['master', 'moderatore', 'amministratore'] // Tutti possono gestire
} as const;

// Mapping Categoria → Priorità Automatica (per sistema escalation)
export const CATEGORY_PRIORITY_MAPPING = {
  // CRITICA (6h escalation)
  [TicketCategory.GAME_BUG_REPORT]: TicketPriority.CRITICAL,
  [TicketCategory.PERFORMANCE_PROBLEM]: TicketPriority.CRITICAL,
  [TicketCategory.WEBSOCKET_PROBLEM]: TicketPriority.CRITICAL,
  
  // ALTA (24h escalation)
  [TicketCategory.CHARACTER_ACCESS_PROBLEM]: TicketPriority.HIGH,
  [TicketCategory.LOCATION_CHAT_PROBLEM]: TicketPriority.HIGH,
  [TicketCategory.OFFGAME_CHAT_PROBLEM]: TicketPriority.HIGH,
  [TicketCategory.POSTAL_SYSTEM_PROBLEM]: TicketPriority.HIGH,
  [TicketCategory.USER_REPORT]: TicketPriority.HIGH,
  
  // MEDIA (48h escalation)
  [TicketCategory.CHARACTER_APPROVAL]: TicketPriority.MEDIUM,
  [TicketCategory.CHARACTER_SHEET_REVIEW]: TicketPriority.MEDIUM,
  [TicketCategory.LOCATION_PROBLEM]: TicketPriority.MEDIUM,
  [TicketCategory.PRIVATE_LOCATION_ACCESS]: TicketPriority.MEDIUM,
  
  // BASSA (5 giorni escalation)
  [TicketCategory.CHARACTER_STATUS_CHANGE]: TicketPriority.LOW,
  [TicketCategory.CORPORATION_JOIN_REQUEST]: TicketPriority.LOW,
  [TicketCategory.CORPORATION_MANAGEMENT_PROBLEM]: TicketPriority.LOW,
  [TicketCategory.GROUP_CHAT_REQUEST]: TicketPriority.LOW,
  [TicketCategory.GENERAL_SUPPORT]: TicketPriority.LOW,
  [TicketCategory.INFORMATION_REQUEST]: TicketPriority.LOW,
  
  // BASSA (7 giorni escalation) 
  [TicketCategory.LOCATION_EVENT_CREATION]: TicketPriority.LOW,
  [TicketCategory.NEW_LOCATION_REQUEST]: TicketPriority.LOW,
  [TicketCategory.NEW_CORPORATION_REQUEST]: TicketPriority.LOW,
  [TicketCategory.IMPROVEMENT_SUGGESTION]: TicketPriority.LOW
} as const;

// Interfacce per Ticket
export interface Ticket {
  id: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  // Creazione
  createdBy: string; // CharacterId
  createdByName: string;
  createdAt: Date;
  
  // Gestione Staff e Reparti
  assignedTo?: string; // AdminId
  assignedToName?: string;
  assignedAt?: Date;
  
  // Sistema Reparti
  department: TicketDepartment;
  departmentHistory?: Array<{
    fromDepartment: TicketDepartment;
    toDepartment: TicketDepartment;
    transferredBy: string; // AdminId
    transferredByName: string;
    transferredAt: Date;
    reason: string;
  }>;
  
  // Storico Riassegnazioni
  reassignmentHistory?: Array<{
    fromStaff: string; // AdminId
    fromStaffName: string;
    toStaff: string; // AdminId
    toStaffName: string;
    reassignedAt: Date;
    reason?: string;
  }>;
  
  closedAt?: Date;
  closedBy?: string; // AdminId
  
  // Tracking lettura
  lastReadBy: {
    character?: Date;
    staff?: Date;
  };
  
  // Escalation System
  escalatedAt?: Date;
  escalationLevel?: number; // 0 = normale, 1 = prima escalation, 2 = seconda escalation
  
  // Metadata
  tags?: string[];
  internalNotes?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: Date;
  isInternal: boolean; // Note interne staff
  readAt?: {
    character?: Date;
    staff?: Date;
  };
}

// WebSocket Events per il sistema ticketing
export interface TicketNotification {
  type: 'ticket_created' | 'ticket_assigned' | 'ticket_reassigned' | 'ticket_transferred' | 'ticket_message' | 'ticket_closed' | 'ticket_reopened';
  ticketId: string;
  title: string;
  category: string;
  department: TicketDepartment;
  
  // Per messaggi
  message?: {
    content: string;
    sender: string;
    sentAt: Date;
  };
  
  // Per assegnazioni  
  assignedTo?: {
    id: string;
    name: string;
  };
  
  // Per riassegnazioni
  reassignment?: {
    fromStaff: {
      id: string;
      name: string;
    };
    toStaff: {
      id: string;
      name: string;
    };
    reason?: string;
  };
  
  // Per trasferimenti tra reparti
  transfer?: {
    fromDepartment: TicketDepartment;
    toDepartment: TicketDepartment;
    transferredBy: {
      id: string;
      name: string;
    };
    reason: string;
  };
  
  // Metadata
  timestamp: Date;
  priority: string;
}

// Error Types
// Error Types - TODO: Import from shared package when workspace configuration is complete
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}