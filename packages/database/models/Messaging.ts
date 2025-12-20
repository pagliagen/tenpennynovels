import mongoose, { Schema, model, Document } from 'mongoose';

// Victorian message types
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
  REGULAR_POST = 'regular_post',
  EXPRESS_POST = 'express_post',
  TELEGRAM = 'telegram',
  HAND_DELIVERY = 'hand_delivery',
  CALLING_CARD = 'calling_card',
  REGISTERED_POST = 'registered_post'
}

// In-Game Messages (Victorian Postal System)
export interface IInGameMessage extends Document {
  type: VictorianMessageType;
  
  // Sender/Recipient (Character level)
  fromCharacterId: Schema.Types.ObjectId;
  fromCharacterName: string;
  toCharacterIds: Schema.Types.ObjectId[];
  
  // Message content
  subject?: string;
  content: string;
  
  // Victorian authenticity
  letterhead?: string;
  seal?: {
    type: 'wax_seal' | 'embossed_seal' | 'corporate_seal';
    design: string;
    color?: string;
    isOfficial: boolean;
    organizationId?: Schema.Types.ObjectId;
  };
  postmark?: {
    origin: string;
    destination: string;
    timestamp: Date;
    postalCode?: string;
    additionalStamps?: string[];
  };
  
  // Delivery simulation
  deliverySettings: {
    sentAt: Date;
    estimatedDelivery: Date;
    actualDelivery?: Date;
    deliveryMethod: VictorianDeliveryMethod;
    cost: number; // in pence
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
  isUrgent: boolean;
  requiresSignature: boolean;
  isConfidential: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Separate Gmail-style inbox/outbox management
export interface IMessageInboxEntry extends Document {
  messageId: Schema.Types.ObjectId;
  characterId: Schema.Types.ObjectId;
  
  // Recipient-specific status
  isRead: boolean;
  readAt?: Date;
  isArchived: boolean;
  isStarred: boolean;
  isDeleted: boolean; // Soft delete (only for this recipient)
  deletedAt?: Date;
  
  // Recipient-specific labels/folders
  labels: string[];
  folderId?: Schema.Types.ObjectId;
  
  // Delivery tracking for recipient
  deliveredAt?: Date;
  
  // Metadata
  addedToInboxAt: Date;
}

export interface IMessageOutboxEntry extends Document {
  messageId: Schema.Types.ObjectId;
  characterId: Schema.Types.ObjectId;
  
  // Sender-specific status
  isDeleted: boolean; // Soft delete (only for sender)
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
  folderId?: Schema.Types.ObjectId;
  
  // Metadata
  addedToOutboxAt: Date;
}

export interface IMessageFolder extends Document {
  characterId: Schema.Types.ObjectId;
  name: string;
  description?: string;
  
  // Folder properties
  isDefault: boolean; // System folders like "Inbox", "Sent"
  color?: string;
  icon?: string;
  
  // Statistics
  messageCount: number;
  unreadCount: number;
  
  // Metadata
  createdAt: Date;
  lastUsed: Date;
}

export interface IMessageLabel extends Document {
  characterId: Schema.Types.ObjectId;
  name: string;
  
  // Label properties
  color: string;
  isDefault: boolean; // System labels like "Important", "Urgent"
  
  // Usage statistics
  usageCount: number;
  lastUsed: Date;
  
  // Metadata
  createdAt: Date;
}


// Location Chat Messages (Real-time WebSocket)
export enum LocationMessageType {
  NORMAL_CHAT = 'normal_chat',
  MASTER_MESSAGE = 'master_message',
  MODERATOR_MESSAGE = 'moderator_message',
  DICE_ROLL = 'dice_roll',
  SKILL_CHECK = 'skill_check',
  STAT_CHECK = 'stat_check',
  ITEM_USAGE = 'item_usage',
  WHISPER = 'whisper',
  ACTION = 'action',
  OOC_REMARK = 'ooc_remark',
  SYSTEM_NOTIFICATION = 'system_notification'
}

export interface ILocationChatMessage extends Document {
  type: LocationMessageType;
  locationId: Schema.Types.ObjectId;
  
  // Sender information
  senderId: Schema.Types.ObjectId; // Character ID or 'system'
  senderName: string;
  senderType: 'character' | 'master' | 'moderator' | 'system' | 'npc';
  
  // Message content
  content: string;
  
  // Special message data
  diceRoll?: {
    diceType: 'd100' | 'd10' | 'd6' | 'd4' | 'd3' | 'd20';
    result: number;
    rollReason?: string;
    isPublic: boolean;
  };
  skillCheck?: {
    skillName: string;
    skillValue: number;
    difficulty: 'automatic' | 'easy' | 'normal' | 'hard' | 'extreme' | 'impossible';
    result: number;
    success: boolean;
    degreeOfSuccess?: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
    modifiers?: {
      name: string;
      value: number;
      reason: string;
    }[];
  };
  itemUsage?: {
    itemId: Schema.Types.ObjectId;
    itemName: string;
    usageType: 'activate' | 'consume' | 'equip' | 'unequip' | 'examine' | 'show';
    success: boolean;
    effectDescription?: string;
    itemConsumed?: boolean;
    durabilityLoss?: number;
    skillBonusApplied?: { [skillName: string]: number };
    isPublic: boolean;
    announcement?: string;
  };
  
  // Target (for whispers, directed actions)
  targetId?: Schema.Types.ObjectId;
  targetName?: string;
  
  // Message properties
  isWhisper: boolean;
  isAction: boolean; // /me actions
  isOOC: boolean; // ((Out of character)) remarks
  
  // Visibility
  visibleTo?: Schema.Types.ObjectId[]; // Specific character IDs (for whispers, private rolls)
  
  // Metadata
  timestamp: Date;
  editedAt?: Date;
}

// Schemas
const InGameMessageSchema = new Schema<IInGameMessage>({
  type: {
    type: String,
    required: true,
    enum: Object.values(VictorianMessageType)
  },
  
  fromCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  fromCharacterName: {
    type: String,
    required: true
  },
  toCharacterIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  }],
  
  subject: String,
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  
  letterhead: String,
  seal: {
    type: { type: String, enum: ['wax_seal', 'embossed_seal', 'corporate_seal'] },
    design: String,
    color: String,
    isOfficial: Boolean,
    organizationId: { type: Schema.Types.ObjectId, refPath: 'seal.isOfficial' }
  },
  postmark: {
    origin: String,
    destination: String,
    timestamp: Date,
    postalCode: String,
    additionalStamps: [String]
  },
  
  deliverySettings: {
    sentAt: { type: Date, required: true },
    estimatedDelivery: { type: Date, required: true },
    actualDelivery: Date,
    deliveryMethod: {
      type: String,
      required: true,
      enum: Object.values(VictorianDeliveryMethod)
    },
    cost: { type: Number, required: true, min: 0 }
  },
  
  status: {
    type: String,
    enum: ['drafted', 'posted', 'in_transit', 'delivered', 'returned', 'lost'],
    default: 'drafted'
  },
  
  readStatus: {
    type: Map,
    of: new Schema({
      isRead: { type: Boolean, default: false },
      readAt: Date
    })
  },
  
  isUrgent: { type: Boolean, default: false },
  requiresSignature: { type: Boolean, default: false },
  isConfidential: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'ingame_messages'
});

const MessageInboxEntrySchema = new Schema<IMessageInboxEntry>({
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'InGameMessage',
    required: true
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  
  isRead: { type: Boolean, default: false },
  readAt: Date,
  isArchived: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  
  labels: [String],
  folderId: {
    type: Schema.Types.ObjectId,
    ref: 'MessageFolder'
  },
  
  deliveredAt: Date,
  addedToInboxAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'message_inbox_entries'
});

const MessageOutboxEntrySchema = new Schema<IMessageOutboxEntry>({
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'InGameMessage',
    required: true
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  isArchived: { type: Boolean, default: false },
  
  deliveryStatus: {
    type: Map,
    of: new Schema({
      recipientName: { type: String, required: true },
      status: {
        type: String,
        enum: ['pending', 'delivered', 'read', 'failed'],
        default: 'pending'
      },
      deliveredAt: Date,
      readAt: Date,
      failureReason: String
    })
  },
  
  labels: [String],
  folderId: {
    type: Schema.Types.ObjectId,
    ref: 'MessageFolder'
  },
  
  addedToOutboxAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'message_outbox_entries'
});

const MessageFolderSchema = new Schema<IMessageFolder>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  isDefault: { type: Boolean, default: false },
  color: String,
  icon: String,
  
  messageCount: { type: Number, default: 0 },
  unreadCount: { type: Number, default: 0 },
  
  lastUsed: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'message_folders'
});

const MessageLabelSchema = new Schema<IMessageLabel>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  
  color: {
    type: String,
    required: true
  },
  isDefault: { type: Boolean, default: false },
  
  usageCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'message_labels'
});



const LocationChatMessageSchema = new Schema<ILocationChatMessage>({
  type: {
    type: String,
    enum: Object.values(LocationMessageType),
    required: true
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  senderId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderType: {
    type: String,
    enum: ['character', 'master', 'moderator', 'system', 'npc'],
    required: true
  },
  
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  diceRoll: {
    diceType: { type: String, enum: ['d100', 'd10', 'd6', 'd4', 'd3', 'd20'] },
    result: Number,
    rollReason: String,
    isPublic: Boolean
  },
  
  skillCheck: {
    skillName: String,
    skillValue: Number,
    difficulty: { type: String, enum: ['automatic', 'easy', 'normal', 'hard', 'extreme', 'impossible'] },
    result: Number,
    success: Boolean,
    degreeOfSuccess: { type: String, enum: ['critical', 'extreme', 'hard', 'regular', 'failure', 'fumble'] },
    modifiers: [{
      name: String,
      value: Number,
      reason: String
    }]
  },
  
  itemUsage: {
    itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
    itemName: String,
    usageType: { type: String, enum: ['activate', 'consume', 'equip', 'unequip', 'examine', 'show'] },
    success: Boolean,
    effectDescription: String,
    itemConsumed: Boolean,
    durabilityLoss: Number,
    skillBonusApplied: { type: Map, of: Number },
    isPublic: Boolean,
    announcement: String
  },
  
  targetId: Schema.Types.ObjectId,
  targetName: String,
  
  isWhisper: { type: Boolean, default: false },
  isAction: { type: Boolean, default: false },
  isOOC: { type: Boolean, default: false },
  
  visibleTo: [{
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }],
  
  timestamp: { type: Date, default: Date.now },
  editedAt: Date
}, {
  collection: 'location_chat_messages'
});

// Indexes
InGameMessageSchema.index({ fromCharacterId: 1, 'deliverySettings.sentAt': -1 });
InGameMessageSchema.index({ toCharacterIds: 1, status: 1 });
InGameMessageSchema.index({ status: 1, 'deliverySettings.estimatedDelivery': 1 });

MessageInboxEntrySchema.index({ characterId: 1, addedToInboxAt: -1 });
MessageInboxEntrySchema.index({ messageId: 1, characterId: 1 }, { unique: true });
MessageInboxEntrySchema.index({ characterId: 1, isRead: 1, isDeleted: 1 });

MessageOutboxEntrySchema.index({ characterId: 1, addedToOutboxAt: -1 });
MessageOutboxEntrySchema.index({ messageId: 1, characterId: 1 }, { unique: true });

MessageFolderSchema.index({ characterId: 1, isDefault: 1 });
MessageLabelSchema.index({ characterId: 1, isDefault: 1 });


LocationChatMessageSchema.index({ locationId: 1, timestamp: -1 });
LocationChatMessageSchema.index({ senderId: 1, timestamp: -1 });

export const InGameMessage = mongoose.models.InGameMessage || model<IInGameMessage>('InGameMessage', InGameMessageSchema);
export const MessageInboxEntry = mongoose.models.MessageInboxEntry || model<IMessageInboxEntry>('MessageInboxEntry', MessageInboxEntrySchema);
export const MessageOutboxEntry = mongoose.models.MessageOutboxEntry || model<IMessageOutboxEntry>('MessageOutboxEntry', MessageOutboxEntrySchema);
export const MessageFolder = mongoose.models.MessageFolder || model<IMessageFolder>('MessageFolder', MessageFolderSchema);
export const MessageLabel = mongoose.models.MessageLabel || model<IMessageLabel>('MessageLabel', MessageLabelSchema);
export const LocationChatMessage = mongoose.models.LocationChatMessage || model<ILocationChatMessage>('LocationChatMessage', LocationChatMessageSchema);