// Off-Game Messages (OOC - Telegram-style Real-time Chat)
export interface OffGameMessage {
  id: string;
  
  // Chat context
  chatId: string;                   // Chat ID (1-to-1 or group)
  chatType: 'direct' | 'group';
  
  // Sender (User level, not character level)
  fromUserId: string;
  fromUsername: string;
  fromDisplayName?: string;
  
  // Message content (text only, simple)
  content: string;
  messageType: 'text' | 'system';   // System messages for group events
  
  // Message status for direct chats
  isRead?: boolean;                 // Only for direct messages
  readAt?: Date;
  
  // Group message read status
  readBy?: {
    userId: string;
    readAt: Date;
  }[];                             // For group messages
  
  // Message management
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;               // Soft delete
  deletedAt?: Date;
  deletedBy?: string;               // Who deleted (for admin actions)
  
  // Reply functionality (simple)
  replyToMessageId?: string;
  replyToContent?: string;          // Cached for performance
  
  // Metadata
  sentAt: Date;
  updatedAt: Date;
}

// Off-Game Chat (1-to-1 or Group)
export interface OffGameChat {
  id: string;
  type: 'direct' | 'group';
  
  // Chat name and description
  name?: string;                    // Only for groups
  description?: string;             // Only for groups
  
  // Participants (users, not characters)
  participants: {
    userId: string;
    username: string;
    displayName?: string;
    role?: 'admin' | 'member';      // Only for groups
    joinedAt: Date;
    lastReadAt?: Date;              // Last time user read messages
    isActive: boolean;              // User is in the chat
  }[];
  
  // Chat settings
  isPrivate: boolean;               // Private groups require invitation
  maxMembers: number;               // Default 50 for groups, 2 for direct
  
  // Chat status
  isArchived: boolean;
  isPinned: boolean;
  
  // Last message info (for chat list)
  lastMessage?: {
    id: string;
    fromUserId: string;
    fromUsername: string;
    content: string;
    sentAt: Date;
    messageType: 'text' | 'system';
  };
  
  // Unread counts per user
  unreadCounts: {
    [userId: string]: number;
  };
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
}

// Direct chat helper (simplified view)
export interface DirectChat {
  chatId: string;
  otherUser: {
    userId: string;
    username: string;
    displayName?: string;
    isOnline: boolean;
    lastSeen?: Date;
  };
  lastMessage?: {
    content: string;
    sentAt: Date;
    fromMe: boolean;
    isRead: boolean;
  };
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

// Group chat summary (for chat list)
export interface GroupChatSummary {
  chatId: string;
  name: string;
  description?: string;
  memberCount: number;
  myRole: 'admin' | 'member';
  lastMessage?: {
    content: string;
    sentAt: Date;
    fromUsername: string;
  };
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

// In-Game Messages (IC - Postal System with Delays)
export interface InGameMessage {
  id: string;
  type: VictorianMessageType;
  
  // Sender/Recipient (Character level)
  fromCharacterId: string;
  fromCharacterName: string;
  toCharacterIds: string[];
  
  // Message content
  subject?: string;                 // For letters, official documents
  content: string;
  
  // Victorian authenticity
  letterhead?: string;              // Official letterhead for businesses/institutions
  seal?: MessageSeal;               // Wax seal information
  postmark?: MessagePostmark;       // Postal service stamps
  
  // Delivery simulation
  deliverySettings: {
    sentAt: Date;                   // When letter was "posted"
    estimatedDelivery: Date;        // When it should be delivered
    actualDelivery?: Date;          // When it was actually delivered
    deliveryMethod: VictorianDeliveryMethod;
    cost: number;                   // Postal cost in pence
  };
  
  // Status tracking
  status: 'drafted' | 'posted' | 'in_transit' | 'delivered' | 'returned' | 'lost';
  
  // Reading status (per recipient)
  readStatus: {
    [characterId: string]: {
      isRead: boolean;
      readAt?: Date;
    };
  };
  
  // Special properties
  isUrgent: boolean;                // Express delivery
  requiresSignature: boolean;       // Registered post
  isConfidential: boolean;          // Private/confidential marking
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Separate management for inbox/outbox like Gmail
export interface MessageInboxEntry {
  messageId: string;
  characterId: string;              // Recipient character
  
  // Recipient-specific status
  isRead: boolean;
  readAt?: Date;
  isArchived: boolean;
  isStarred: boolean;
  isDeleted: boolean;               // Soft delete (only for this recipient)
  deletedAt?: Date;
  
  // Recipient-specific labels/folders
  labels: string[];                 // Custom labels like "Important", "Personal", etc.
  folderId?: string;                // Custom folder organization
  
  // Delivery tracking for recipient
  deliveredAt?: Date;
  
  // Metadata
  addedToInboxAt: Date;             // When message was delivered to this recipient
}

export interface MessageOutboxEntry {
  messageId: string;
  characterId: string;              // Sender character
  
  // Sender-specific status
  isDeleted: boolean;               // Soft delete (only for sender)
  deletedAt?: Date;
  isArchived: boolean;
  
  // Sender tracking
  deliveryStatus: {
    [recipientCharacterId: string]: {
      recipientName: string;
      status: 'pending' | 'delivered' | 'read' | 'failed';
      deliveredAt?: Date;
      readAt?: Date;
      failureReason?: string;
    };
  };
  
  // Sender labels/organization
  labels: string[];
  folderId?: string;
  
  // Metadata
  addedToOutboxAt: Date;            // When message was sent
}

// Character mailbox summary
export interface CharacterMailbox {
  characterId: string;
  characterName: string;
  
  // Inbox summary
  inbox: {
    totalMessages: number;
    unreadCount: number;
    archivedCount: number;
    recentMessages: MessageInboxEntry[];
  };
  
  // Outbox summary
  outbox: {
    totalSent: number;
    pendingDelivery: number;
    archivedCount: number;
    recentMessages: MessageOutboxEntry[];
  };
  
  // Drafts
  drafts: {
    totalDrafts: number;
    recentDrafts: InGameMessage[];
  };
  
  // Custom organization
  folders: MessageFolder[];
  labels: MessageLabel[];
  
  // Settings
  settings: {
    autoReadReceipts: boolean;      // Send read receipts automatically
    groupByConversation: boolean;   // Group related messages
    showPreview: boolean;           // Show message preview in list
  };
  
  // Last activity
  lastChecked: Date;
}

export interface MessageFolder {
  id: string;
  name: string;
  description?: string;
  characterId: string;
  
  // Folder properties
  isDefault: boolean;               // System folders like "Inbox", "Sent"
  color?: string;                   // UI color
  icon?: string;                    // UI icon
  
  // Statistics
  messageCount: number;
  unreadCount: number;
  
  // Metadata
  createdAt: Date;
  lastUsed: Date;
}

export interface MessageLabel {
  id: string;
  name: string;
  characterId: string;
  
  // Label properties
  color: string;                    // UI color
  isDefault: boolean;               // System labels like "Important", "Urgent"
  
  // Usage statistics
  usageCount: number;
  lastUsed: Date;
  
  // Metadata
  createdAt: Date;
}

// Off-Game messaging API interfaces
export interface OOCMessageSendRequest {
  chatId: string;
  content: string;
  replyToMessageId?: string;
}

export interface OOCChatCreateRequest {
  type: 'direct' | 'group';
  name?: string;                    // Required for groups
  description?: string;             // Optional for groups
  participants: string[];           // User IDs
  isPrivate?: boolean;              // Default true for groups
}

export interface OOCGroupInviteRequest {
  chatId: string;
  userIds: string[];
}

export interface OOCChatListRequest {
  type?: 'direct' | 'group' | 'all';
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface OOCMessageHistoryRequest {
  chatId: string;
  limit?: number;                   // Default 50
  beforeMessageId?: string;         // For pagination
  afterMessageId?: string;          // For loading newer messages
}

export interface OOCChatActionRequest {
  chatId: string;
  action: 'archive' | 'unarchive' | 'pin' | 'unpin' | 'leave' | 'delete_chat';
}

export interface OOCMessageActionRequest {
  messageId: string;
  action: 'edit' | 'delete' | 'mark_read';
  newContent?: string;              // For edit action
}

// API Request/Response interfaces (In-Game Messages)
export interface MessageSendRequest {
  type: VictorianMessageType;
  recipients: string[];             // Character IDs
  subject?: string;
  content: string;
  deliveryMethod: VictorianDeliveryMethod;
  isUrgent: boolean;
  requiresSignature: boolean;
  isConfidential: boolean;
  
  // Optional properties
  letterhead?: string;
  sealType?: 'wax_seal' | 'embossed_seal' | 'corporate_seal';
  sealDesign?: string;
  
  // Draft management
  isDraft?: boolean;
  draftId?: string;                 // If updating existing draft
}

export interface MessageListRequest {
  mailboxType: 'inbox' | 'outbox' | 'drafts';
  page?: number;
  limit?: number;
  folderId?: string;
  labels?: string[];
  
  // Filters
  filters?: {
    isRead?: boolean;
    isArchived?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    sender?: string;               // Character name or ID
    messageType?: VictorianMessageType;
    hasAttachments?: boolean;
  };
  
  // Sorting
  sortBy?: 'date' | 'sender' | 'subject' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface MessageActionRequest {
  messageIds: string[];
  action: 'mark_read' | 'mark_unread' | 'archive' | 'unarchive' | 'delete' | 'star' | 'unstar' | 'move_to_folder' | 'add_label' | 'remove_label';
  
  // Action-specific parameters
  folderId?: string;               // For move_to_folder
  labelIds?: string[];             // For add_label/remove_label
}

export enum VictorianMessageType {
  PERSONAL_LETTER = 'personal_letter',
  BUSINESS_LETTER = 'business_letter',
  TELEGRAM = 'telegram',
  POSTCARD = 'postcard',
  INVITATION = 'invitation',
  OFFICIAL_DOCUMENT = 'official_document',
  CALLING_CARD = 'calling_card',
  NOTICE = 'notice',
  CIRCULAR = 'circular',
  LOVE_LETTER = 'love_letter',
  CONDOLENCE = 'condolence'
}

export enum VictorianDeliveryMethod {
  REGULAR_POST = 'regular_post',        // Standard postal service
  EXPRESS_POST = 'express_post',        // Faster, more expensive
  TELEGRAM = 'telegram',                // Near-instant, very expensive
  HAND_DELIVERY = 'hand_delivery',      // Personal messenger
  CALLING_CARD = 'calling_card',        // Left at residence
  REGISTERED_POST = 'registered_post'   // Secure, requires signature
}

export interface MessageSeal {
  type: 'wax_seal' | 'embossed_seal' | 'corporate_seal';
  design: string;                       // Description of seal design
  color?: string;                       // Wax color
  isOfficial: boolean;                  // Official organization seal
  organizationId?: string;              // Corporation/institution ID
}

export interface MessagePostmark {
  origin: string;                       // Where letter was posted
  destination: string;                  // Where it's being delivered
  timestamp: Date;                      // When it was processed
  postalCode?: string;                  // Victorian postal district
  additionalStamps?: string[];          // Additional postal markings
}

// Location Chat Messages (Real-time WebSocket)
export interface LocationChatMessage {
  id: string;
  type: LocationMessageType;
  locationId: string;
  
  // Sender information
  senderId: string;                     // Character ID or 'system'
  senderName: string;
  senderType: 'character' | 'master' | 'moderator' | 'system' | 'npc';
  
  // Message content
  content: string;
  
  // Special message data
  diceRoll?: DiceRollResult;
  skillCheck?: SkillCheckResult;
  itemUsage?: ChatItemUsage;
  
  // Target (for whispers, directed actions)
  targetId?: string;                    // Character ID
  targetName?: string;
  
  // Message properties
  isWhisper: boolean;
  isAction: boolean;                    // /me actions
  isOOC: boolean;                       // ((Out of character)) remarks
  
  // Visibility
  visibleTo?: string[];                 // Specific character IDs (for whispers, private rolls)
  
  // Metadata
  timestamp: Date;
  editedAt?: Date;
}

export enum LocationMessageType {
  NORMAL_CHAT = 'normal_chat',
  MASTER_MESSAGE = 'master_message',        // GM/Staff messages
  MODERATOR_MESSAGE = 'moderator_message',  // Moderation messages
  DICE_ROLL = 'dice_roll',
  SKILL_CHECK = 'skill_check',
  STAT_CHECK = 'stat_check',
  ITEM_USAGE = 'item_usage',
  WHISPER = 'whisper',
  ACTION = 'action',                        // /me style actions
  OOC_REMARK = 'ooc_remark',               // ((Out of character))
  SYSTEM_NOTIFICATION = 'system_notification'
}

export interface DiceRollResult {
  diceType: 'd100' | 'd10' | 'd6' | 'd4' | 'd3' | 'd20';
  result: number;
  rollReason?: string;                  // Why the roll was made
  isPublic: boolean;                    // Visible to all or just GM
}

export interface SkillCheckResult extends DiceRollResult {
  skillName: string;
  skillValue: number;                   // Character's skill level
  difficulty: 'automatic' | 'easy' | 'normal' | 'hard' | 'extreme' | 'impossible';
  success: boolean;
  degreeOfSuccess?: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
  
  // Modifiers
  modifiers?: {
    name: string;
    value: number;
    reason: string;
  }[];
}

export interface StatCheckResult extends DiceRollResult {
  statName: string;
  statValue: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  success: boolean;
  
  // Context
  checkReason: string;                  // What triggered the stat check
}

export interface ChatItemUsage {
  itemId: string;
  itemName: string;
  usageType: 'activate' | 'consume' | 'equip' | 'unequip' | 'examine' | 'show';
  
  // Results
  success: boolean;
  effectDescription?: string;           // What happened
  
  // Consequences
  itemConsumed?: boolean;
  durabilityLoss?: number;
  skillBonusApplied?: { [skillName: string]: number };
  
  // Visibility
  isPublic: boolean;                    // Others can see the usage
  announcement?: string;                // Public description of usage
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'map' | 'character_sheet' | 'item_description';
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  
  // Victorian context
  description?: string;                 // What the attachment represents
  isOfficial?: boolean;                 // Official document/seal
  
  // Metadata
  uploadedAt: Date;
  uploadedBy: string;
}

// Message delivery simulation
export interface PostalService {
  calculateDeliveryTime(
    messageType: VictorianMessageType,
    fromLocation: string,
    toLocation: string,
    deliveryMethod: VictorianDeliveryMethod,
    isUrgent: boolean
  ): {
    estimatedHours: number;
    cost: number;                       // In pence
    reliability: number;                // Chance of successful delivery (0-100)
  };
  
  processDelivery(messageId: string): Promise<{
    delivered: boolean;
    actualDeliveryTime: Date;
    deliveryNote?: string;              // Issues during delivery
  }>;
}

// WebSocket events for real-time messaging
export interface MessagingEvents {
  // Off-game messaging (Telegram-style)
  'ooc_message_received': (message: OffGameMessage) => void;
  'ooc_message_edited': (message: OffGameMessage) => void;
  'ooc_message_deleted': (messageId: string, chatId: string) => void;
  'ooc_message_read': (messageId: string, chatId: string, readBy: string) => void;
  'ooc_typing_start': (chatId: string, userId: string, username: string) => void;
  'ooc_typing_stop': (chatId: string, userId: string) => void;
  
  // Chat management
  'ooc_chat_created': (chat: OffGameChat) => void;
  'ooc_chat_updated': (chat: OffGameChat) => void;
  'ooc_user_joined_chat': (chatId: string, user: { userId: string; username: string }) => void;
  'ooc_user_left_chat': (chatId: string, userId: string) => void;
  'ooc_chat_archived': (chatId: string, archivedBy: string) => void;
  
  // Location chat
  'location_message_sent': (message: LocationChatMessage) => void;
  'location_message_received': (message: LocationChatMessage) => void;
  'location_typing_start': (characterId: string, locationId: string) => void;
  'location_typing_stop': (characterId: string, locationId: string) => void;
  
  // In-game postal system
  'letter_posted': (message: InGameMessage) => void;
  'letter_delivered': (message: InGameMessage) => void;
  'letter_returned': (message: InGameMessage, reason: string) => void;
  
  // Special events
  'dice_rolled': (result: DiceRollResult, characterId: string, locationId: string) => void;
  'skill_checked': (result: SkillCheckResult, characterId: string, locationId: string) => void;
  'item_used': (result: ChatItemUsage, characterId: string, locationId: string) => void;
}