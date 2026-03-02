# Messaging System Documentation

## Overview

TenpennyNovels implementa un sistema di comunicazione completo con tre modalità distinte e integrate:

1. **Location Chat**: Comunicazione in tempo reale basata su posizione con azioni di ruolo e meccaniche di gioco
2. **OnGame Messages**: Sistema postale vittoriano autentico con delivery schedulato e meccaniche storiche
3. **OffGame Chat**: Messaggistica OOC stile Telegram per comunicazioni fuori dal personaggio

## Architecture Overview

```typescript
interface MessagingSystem {
  locationChat: LocationChatSystem;
  onGameMessages: PostalSystem; 
  offGameChat: OOCChatSystem;
  webSocketEvents: UnifiedEventSystem;
}

// Unified messaging types
enum MessageSystem {
  LOCATION_CHAT = 'location_chat',
  ONGAME_POSTAL = 'ongame_postal', 
  OFFGAME_CHAT = 'offgame_chat'
}

enum MessagePriority {
  REALTIME = 'realtime',       // Immediate delivery
  SCHEDULED = 'scheduled',     // Victorian postal timing
  ASYNC = 'async'              // Standard messaging
}
```

## 1. Location Chat System

### Core Architecture

```typescript
interface LocationMessage {
  _id: ObjectId;
  locationId: ObjectId;
  characterId: ObjectId;
  characterName: string;
  content: string;
  actionType: LocationActionType;
  visibility: MessageVisibility;
  
  // Role-playing mechanics
  targetCharacters?: ObjectId[]; // For whispers/targeted actions
  diceResult?: DiceRollResult;
  itemEffect?: ItemUsageEffect;
  
  // Metadata
  timestamp: Date;
  characterRoles: GameplayRole[];
  moderationFlags?: ModerationFlag[];
}

enum LocationActionType {
  STANDARD = 'standard',         // Normal character speech/action
  MASTER = 'master',             // Narrative control, NPC dialogue
  MODERATION = 'moderation',     // Disciplinary actions
  WHISPER = 'whisper',           // Private to specific characters
  OOC = 'ooc',                  // Out of character communication
  DICE_GENERIC = 'dice_generic', // Generic dice roll
  DICE_SKILL = 'dice_skill',     // Skill/characteristic test
  DICE_DAMAGE = 'dice_damage',   // Combat damage rolls
  ITEM_USAGE = 'item_usage',     // Using equipped items/tools
  EMOTE = 'emote',              // Character emotive actions
  SYSTEM = 'system'             // System-generated messages
}

enum MessageVisibility {
  PUBLIC = 'public',             // Everyone in location sees
  WHISPER = 'whisper',          // Only targeted characters
  MASTER_ONLY = 'master_only',   // Only masters/mods see
  PRIVATE = 'private',           // Character notes
  SYSTEM = 'system'             // System messages
}
```

### Role-Based Action System

```typescript
interface RolePermissions {
  canUseAction: (action: LocationActionType, roles: GameplayRole[]) => boolean;
  canSeeMessage: (message: LocationMessage, viewerRoles: GameplayRole[]) => boolean;
  canModerateChat: (roles: GameplayRole[]) => boolean;
}

const getAvailableActions = (characterRoles: GameplayRole[]): LocationActionType[] => {
  const baseActions = [
    LocationActionType.STANDARD,
    LocationActionType.OOC,
    LocationActionType.WHISPER,
    LocationActionType.EMOTE,
    LocationActionType.DICE_GENERIC,
    LocationActionType.DICE_SKILL,
    LocationActionType.ITEM_USAGE
  ];
  
  // Master-specific actions
  if (characterRoles.includes('master') || characterRoles.includes('amministratore')) {
    baseActions.push(
      LocationActionType.MASTER,
      LocationActionType.DICE_DAMAGE,
      LocationActionType.SYSTEM
    );
  }
  
  // Moderation actions
  if (characterRoles.includes('moderatore') || characterRoles.includes('amministratore')) {
    baseActions.push(LocationActionType.MODERATION);
  }
  
  return baseActions;
};

// Message visibility rules
const canViewMessage = (
  message: LocationMessage, 
  viewerCharacter: Character
): boolean => {
  // Public messages visible to all in location
  if (message.visibility === MessageVisibility.PUBLIC) {
    return true;
  }
  
  // Whispers only visible to targets and sender
  if (message.visibility === MessageVisibility.WHISPER) {
    return message.characterId.equals(viewerCharacter._id) ||
           message.targetCharacters?.some(id => id.equals(viewerCharacter._id));
  }
  
  // Master-only messages for staff
  if (message.visibility === MessageVisibility.MASTER_ONLY) {
    return viewerCharacter.roles.includes('master') ||
           viewerCharacter.roles.includes('moderatore') ||
           viewerCharacter.roles.includes('amministratore');
  }
  
  // Private messages only to sender
  if (message.visibility === MessageVisibility.PRIVATE) {
    return message.characterId.equals(viewerCharacter._id);
  }
  
  return false;
};
```

### Dice Rolling Integration

```typescript
interface DiceRollResult {
  type: 'generic' | 'skill' | 'characteristic' | 'damage';
  dice: string; // e.g., "1d100", "2d6+3"
  results: number[];
  total: number;
  
  // Call of Cthulhu specific
  targetValue?: number;
  success?: 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
  skillName?: string;
  characteristicName?: string;
}

// Dice rolling for skills and characteristics
const rollSkillCheck = (
  skillValue: number, 
  modifier: number = 0
): DiceRollResult => {
  const roll = Math.floor(Math.random() * 100) + 1;
  const adjustedSkill = skillValue + modifier;
  
  let success: string;
  if (roll === 1) success = 'critical';
  else if (roll <= adjustedSkill / 5) success = 'extreme';
  else if (roll <= adjustedSkill / 2) success = 'hard';
  else if (roll <= adjustedSkill) success = 'regular';
  else if (roll >= 96) success = 'fumble';
  else success = 'failure';
  
  return {
    type: 'skill',
    dice: '1d100',
    results: [roll],
    total: roll,
    targetValue: adjustedSkill,
    success
  };
};

// Send dice roll message
const sendDiceRollMessage = async (
  locationId: string,
  characterId: string,
  rollData: {
    type: 'generic' | 'skill' | 'characteristic';
    dice?: string;
    skillName?: string;
    modifier?: number;
  }
) => {
  const character = await Character.findById(characterId);
  
  let diceResult: DiceRollResult;
  let content: string;
  
  if (rollData.type === 'skill' && rollData.skillName) {
    const skillValue = character.skills.get(rollData.skillName) || 0;
    diceResult = rollSkillCheck(skillValue, rollData.modifier || 0);
    content = `${character.name} testa ${rollData.skillName} (${skillValue}): ${diceResult.total}/100 - ${diceResult.success?.toUpperCase()}`;
  } else {
    // Generic dice roll
    diceResult = rollGenericDice(rollData.dice || '1d100');
    content = `${character.name} tira ${rollData.dice}: ${diceResult.total}`;
  }
  
  const message = new LocationMessage({
    locationId,
    characterId,
    characterName: character.name,
    content,
    actionType: rollData.type === 'generic' ? 'dice_generic' : 'dice_skill',
    visibility: MessageVisibility.PUBLIC,
    diceResult,
    timestamp: new Date(),
    characterRoles: character.roles
  });
  
  await message.save();
  await broadcastLocationMessage(message);
  
  return message;
};
```

### WebSocket Location Chat Integration

```typescript
// Real-time location chat management
class LocationChatManager {
  private io: SocketIOServer;
  
  constructor(io: SocketIOServer) {
    this.io = io;
  }
  
  // Character joins location
  async joinLocation(socket: Socket, locationId: string, characterId: string) {
    const character = await Character.findById(characterId);
    if (!character) throw new Error('Character not found');
    
    // Verify location access
    const canAccess = await this.verifyLocationAccess(characterId, locationId);
    if (!canAccess) throw new Error('Access denied to location');
    
    // Join WebSocket room
    await socket.join(`location:${locationId}`);
    
    // Load recent message history
    const recentMessages = await this.getLocationHistory(locationId, character);
    socket.emit('location:history', recentMessages);
    
    // Broadcast character entry
    socket.to(`location:${locationId}`).emit('location:character_entered', {
      characterId,
      characterName: character.name,
      timestamp: new Date()
    });
    
    // Update character current location
    await Character.findByIdAndUpdate(characterId, {
      currentLocation: locationId,
      lastActive: new Date()
    });
  }
  
  // Send location message
  async sendMessage(
    socket: Socket,
    locationId: string,
    messageData: {
      content: string;
      actionType: LocationActionType;
      targetCharacters?: string[];
    }
  ) {
    const characterId = socket.character.characterId;
    const character = await Character.findById(characterId);
    
    // Validate message content
    const sanitizedContent = this.sanitizeContent(messageData.content);
    if (!sanitizedContent.trim()) throw new Error('Empty message');
    
    // Create location message
    const message = new LocationMessage({
      locationId,
      characterId,
      characterName: character.name,
      content: sanitizedContent,
      actionType: messageData.actionType,
      visibility: this.determineVisibility(messageData),
      targetCharacters: messageData.targetCharacters || [],
      timestamp: new Date(),
      characterRoles: character.roles
    });
    
    await message.save();
    
    // Cache recent messages
    await this.cacheLocationMessage(locationId, message);
    
    // Broadcast based on visibility
    await this.broadcastMessage(locationId, message);
    
    return message;
  }
  
  private async broadcastMessage(locationId: string, message: LocationMessage) {
    const room = `location:${locationId}`;
    
    switch (message.visibility) {
      case MessageVisibility.PUBLIC:
        this.io.to(room).emit('location:message', message);
        break;
        
      case MessageVisibility.WHISPER:
        // Send to sender
        this.io.to(`character:${message.characterId}`).emit('location:message', message);
        
        // Send to targets
        if (message.targetCharacters?.length > 0) {
          message.targetCharacters.forEach(targetId => {
            this.io.to(`character:${targetId}`).emit('location:message', message);
          });
        }
        break;
        
      case MessageVisibility.MASTER_ONLY:
        // Send only to staff members in location
        const locationClients = await this.io.in(room).fetchSockets();
        for (const client of locationClients) {
          const character = await Character.findById(client.character?.characterId);
          if (character && this.hasStaffRole(character.roles)) {
            client.emit('location:message', { ...message, isStaffOnly: true });
          }
        }
        break;
    }
  }
  
  private async getLocationHistory(locationId: string, viewer: Character): Promise<LocationMessage[]> {
    const messages = await LocationMessage.find({
      locationId
    })
    .sort({ timestamp: -1 })
    .limit(50);
    
    // Filter messages based on viewer permissions
    return messages.filter(message => canViewMessage(message, viewer))
                  .reverse(); // Chronological order for display
  }
}
```

## 2. OnGame Messages (Victorian Postal System)

### Victorian Message Types

```typescript
interface PostalMessageType {
  id: string;
  name: string;
  description: string;
  deliveryMode: DeliveryMode;
  maxRecipients: number;
  postageRequired: number; // In pence
  deliveryTime: DeliveryTiming;
  isSealed: boolean;
  requiresRole?: GameplayRole[];
  historicalContext: string;
}

enum DeliveryMode {
  REALTIME = 'realtime',           // Bigliettini - instant
  SCHEDULED_FIXED = 'scheduled_fixed', // Telegrammi - fixed delay
  SCHEDULED_VARIABLE = 'scheduled_variable', // Inviti - variable delay
  DAILY_BATCH = 'daily_batch',     // Lettere - daily postal rounds
  MESSENGER_BOY = 'messenger_boy', // Express - messenger delivery
  NO_DELIVERY = 'no_delivery',     // Diario - personal notes
  OFFICIAL = 'official'            // Documenti ufficiali - administrative
}

interface DeliveryTiming {
  fixed?: number;        // Fixed minutes
  variable?: [number, number]; // Range in minutes [min, max]
  dailyTimes?: string[]; // Fixed daily delivery times ["09:00", "15:00", "18:00"]
  workingDaysOnly?: boolean; // Exclude Sundays
}

const VICTORIAN_MESSAGE_TYPES: PostalMessageType[] = [
  {
    id: 'bigliettini',
    name: 'Bigliettini',
    description: 'Note brevi e istantanee tra personaggi',
    deliveryMode: DeliveryMode.REALTIME,
    maxRecipients: 1,
    postageRequired: 0,
    deliveryTime: {},
    isSealed: false,
    historicalContext: 'Piccole note passate di mano in società vittoriane'
  },
  {
    id: 'telegrammi',
    name: 'Telegrammi',
    description: 'Messaggi urgenti via sistema telegrafico',
    deliveryMode: DeliveryMode.SCHEDULED_FIXED,
    maxRecipients: 3,
    postageRequired: 3, // 3 pence - costoso per epoca
    deliveryTime: { fixed: 20 }, // 20 minuti
    isSealed: false,
    historicalContext: 'Tecnologia telegrafica introdotta negli anni 1840-1870'
  },
  {
    id: 'lettere_formali',
    name: 'Lettere Formali',
    description: 'Corrispondenza ufficiale sigillata con ceralacca',
    deliveryMode: DeliveryMode.DAILY_BATCH,
    maxRecipients: 1,
    postageRequired: 1, // 1 pence - tariffa postale standard
    deliveryTime: { 
      dailyTimes: ['09:00', '15:00', '18:00'],
      workingDaysOnly: true 
    },
    isSealed: true,
    historicalContext: 'Sistema postale Royal Mail con consegne multiple giornaliere'
  },
  {
    id: 'lettere_espresse',
    name: 'Lettere Espresse',
    description: 'Consegna rapida tramite messaggero privato',
    deliveryMode: DeliveryMode.MESSENGER_BOY,
    maxRecipients: 1,
    postageRequired: 4, // 4 pence - servizio premium
    deliveryTime: { variable: [10, 20] }, // 10-20 minuti
    isSealed: true,
    historicalContext: 'Messaggeri privati per consegne urgenti nella Londra vittoriana'
  },
  {
    id: 'cartoline',
    name: 'Cartoline Postali',
    description: 'Messaggi brevi su cartolina illustrata',
    deliveryMode: DeliveryMode.DAILY_BATCH,
    maxRecipients: 5,
    postageRequired: 0.5, // Mezza pence - economico
    deliveryTime: { dailyTimes: ['09:00', '15:00', '18:00'] },
    isSealed: false,
    historicalContext: 'Cartoline introdotte nel 1870, molto popolari'
  },
  {
    id: 'inviti_formali',
    name: 'Inviti Formali',
    description: 'Inviti eleganti per eventi e ricevimenti sociali',
    deliveryMode: DeliveryMode.SCHEDULED_VARIABLE,
    maxRecipients: 15,
    postageRequired: 2, // 2 pence
    deliveryTime: { variable: [240, 360] }, // 4-6 ore
    isSealed: false,
    historicalContext: 'Inviti per eventi societari con preavviso appropriato'
  },
  {
    id: 'documenti_ufficiali',
    name: 'Documenti Ufficiali',
    description: 'Comunicazioni amministrative e decreti ufficiali',
    deliveryMode: DeliveryMode.OFFICIAL,
    maxRecipients: 50,
    postageRequired: 6, // 6 pence - servizio ufficiale costoso
    deliveryTime: { variable: [1440, 2880] }, // 24-48 ore
    isSealed: true,
    requiresRole: ['master', 'moderatore', 'amministratore'],
    historicalContext: 'Documentazione ufficiale con tempi burocratici realistici'
  },
  {
    id: 'diario_personale',
    name: 'Diario Personale',
    description: 'Note private del personaggio, non consegnate',
    deliveryMode: DeliveryMode.NO_DELIVERY,
    maxRecipients: 0, // Solo per se stessi
    postageRequired: 0,
    deliveryTime: {},
    isSealed: false,
    historicalContext: 'Diari privati per sviluppo del personaggio'
  }
];
```

### OnGame Message Database Model

```typescript
interface OnGameMessage {
  _id: ObjectId;
  type: string; // Message type ID
  from: ObjectId; // Sender character
  recipients: ObjectId[]; // Recipient characters
  subject?: string;
  content: string;
  
  // Victorian Postal Mechanics
  postageRequired: number;
  postageDeducted: number;
  scheduledDelivery: Date;
  deliveryMode: DeliveryMode;
  deliveredAt?: Date;
  isDelivered: boolean;
  
  // Express delivery options
  expressDelivery: boolean;
  expressMultiplier: number; // Cost multiplier for express
  
  // Message properties
  isSealed: boolean;
  sealBroken?: Date; // When seal was broken (for sealed messages)
  sealBrokenBy?: ObjectId; // Who broke the seal
  
  // Tracking
  createdAt: Date;
  deliveryAttempts: number;
  lastDeliveryAttempt?: Date;
  failureReason?: string;
}

// Gmail-style message views for independent inbox/outbox management
interface OnGameMessageView {
  _id: ObjectId;
  messageId: ObjectId;
  characterId: ObjectId;
  viewType: 'inbox' | 'outbox';
  
  // Message management
  read: boolean;
  readAt?: Date;
  archived: boolean;
  starred: boolean;
  folder: string;
  labels: string[];
  deleted: boolean; // Soft delete
  
  // Delivery status
  deliveredAt?: Date;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  
  createdAt: Date;
}
```

### Automated Victorian Postal System

```typescript
import cron from 'node-cron';

class VictorianPostalSystem {
  
  // Instant delivery for bigliettini (every minute)
  @cron.schedule('*/1 * * * *')
  async processRealtimeDeliveries() {
    console.log('Processing realtime postal deliveries...');
    
    const messages = await OnGameMessage.find({
      deliveryMode: DeliveryMode.REALTIME,
      scheduledDelivery: { $lte: new Date() },
      isDelivered: false
    });
    
    for (const message of messages) {
      await this.deliverMessage(message);
    }
  }
  
  // Daily postal rounds (9 AM, 3 PM, 6 PM)
  @cron.schedule('0 9,15,18 * * *')
  async processDailyBatchDeliveries() {
    console.log('Processing daily postal batch...');
    
    const messages = await OnGameMessage.find({
      deliveryMode: DeliveryMode.DAILY_BATCH,
      scheduledDelivery: { $lte: new Date() },
      isDelivered: false
    });
    
    // Batch delivery with Victorian postal authenticity
    const deliveryBatch = {
      deliveryTime: new Date(),
      messagesDelivered: messages.length,
      postalRound: this.getCurrentPostalRound()
    };
    
    await Promise.all(messages.map(message => this.deliverMessage(message)));
    
    // Log postal round completion
    await this.logPostalRound(deliveryBatch);
  }
  
  // Scheduled deliveries (telegrams, express, etc.) - every 15 minutes
  @cron.schedule('*/15 * * * *')
  async processScheduledDeliveries() {
    const messages = await OnGameMessage.find({
      deliveryMode: { 
        $in: [
          DeliveryMode.SCHEDULED_FIXED, 
          DeliveryMode.SCHEDULED_VARIABLE,
          DeliveryMode.MESSENGER_BOY,
          DeliveryMode.OFFICIAL
        ]
      },
      scheduledDelivery: { $lte: new Date() },
      isDelivered: false
    });
    
    for (const message of messages) {
      await this.deliverMessage(message);
      
      // Add realistic delivery delay between messages
      if (message.deliveryMode === DeliveryMode.MESSENGER_BOY) {
        await this.simulateMessengerDelay();
      }
    }
  }
  
  private async deliverMessage(message: OnGameMessage) {
    try {
      // Mark as delivered
      await OnGameMessage.findByIdAndUpdate(message._id, {
        isDelivered: true,
        deliveredAt: new Date(),
        deliveryAttempts: (message.deliveryAttempts || 0) + 1
      });
      
      // Update message views for recipients
      await this.updateRecipientViews(message);
      
      // Send delivery notifications
      await this.sendDeliveryNotifications(message);
      
      // Publish delivery event
      await this.publishDeliveryEvent(message);
      
    } catch (error) {
      console.error(`Failed to deliver message ${message._id}:`, error);
      
      await OnGameMessage.findByIdAndUpdate(message._id, {
        deliveryAttempts: (message.deliveryAttempts || 0) + 1,
        lastDeliveryAttempt: new Date(),
        failureReason: error.message
      });
    }
  }
  
  private async updateRecipientViews(message: OnGameMessage) {
    // Update inbox views for all recipients
    await OnGameMessageView.updateMany(
      {
        messageId: message._id,
        viewType: 'inbox'
      },
      {
        deliveredAt: new Date(),
        deliveryStatus: 'delivered'
      }
    );
  }
  
  private async sendDeliveryNotifications(message: OnGameMessage) {
    const messageType = VICTORIAN_MESSAGE_TYPES.find(t => t.id === message.type);
    
    for (const recipientId of message.recipients) {
      // Send WebSocket notification
      await this.io.to(`character:${recipientId}`).emit('ongame:message_delivered', {
        messageId: message._id,
        messageType: messageType?.name || 'Message',
        subject: message.subject,
        from: await this.getCharacterName(message.from),
        deliveredAt: new Date()
      });
      
      // Update notification badges
      await this.updateInboxBadge(recipientId);
    }
  }
  
  private getCurrentPostalRound(): string {
    const hour = new Date().getHours();
    if (hour === 9) return 'morning';
    if (hour === 15) return 'afternoon'; 
    if (hour === 18) return 'evening';
    return 'special';
  }
}
```

### Message Composition & Sending

```typescript
class OnGameMessageService {
  
  async sendOnGameMessage(messageData: {
    type: string;
    from: string;
    recipients: string[];
    subject?: string;
    content: string;
    expressDelivery?: boolean;
  }): Promise<OnGameMessage> {
    
    // Validate message type
    const messageType = VICTORIAN_MESSAGE_TYPES.find(t => t.id === messageData.type);
    if (!messageType) {
      throw new Error('Invalid message type');
    }
    
    // Check recipient limits
    if (messageData.recipients.length > messageType.maxRecipients) {
      throw new Error(`Too many recipients. Maximum allowed: ${messageType.maxRecipients}`);
    }
    
    // Verify sender permissions
    const sender = await Character.findById(messageData.from);
    if (!sender) throw new Error('Sender not found');
    
    if (messageType.requiresRole) {
      const hasRequiredRole = messageType.requiresRole.some(role => 
        sender.roles.includes(role)
      );
      if (!hasRequiredRole) {
        throw new Error(`Requires role: ${messageType.requiresRole.join(' or ')}`);
      }
    }
    
    // Calculate costs and delivery time
    let postageRequired = messageType.postageRequired;
    let deliveryTime = this.calculateDeliveryTime(messageType);
    let expressMultiplier = 1;
    
    if (messageData.expressDelivery && messageType.deliveryMode !== DeliveryMode.REALTIME) {
      expressMultiplier = 2;
      postageRequired *= expressMultiplier;
      deliveryTime = Math.max(Math.floor(deliveryTime / 2), 5); // Halve time, minimum 5 minutes
    }
    
    // Check sender's wallet
    if (sender.wallet.cash < postageRequired) {
      throw new Error(`Insufficient funds. Required: ${postageRequired} pence, available: ${sender.wallet.cash} pence`);
    }
    
    // Calculate scheduled delivery time
    const scheduledDelivery = this.calculateScheduledDelivery(messageType, deliveryTime);
    
    // Create message
    const message = new OnGameMessage({
      type: messageData.type,
      from: messageData.from,
      recipients: messageData.recipients,
      subject: messageData.subject,
      content: this.sanitizeContent(messageData.content),
      postageRequired,
      postageDeducted: postageRequired,
      scheduledDelivery,
      deliveryMode: messageType.deliveryMode,
      expressDelivery: messageData.expressDelivery || false,
      expressMultiplier,
      isSealed: messageType.isSealed,
      isDelivered: false,
      deliveryAttempts: 0,
      createdAt: new Date()
    });
    
    await message.save();
    
    // Deduct postage from sender
    await Character.findByIdAndUpdate(messageData.from, {
      $inc: { 'wallet.cash': -postageRequired }
    });
    
    // Create message views
    await this.createMessageViews(message);
    
    // Log postal transaction
    await this.logPostalTransaction(message, sender);
    
    // Publish scheduling event
    await redis.publish('ongame:events', JSON.stringify({
      type: 'MESSAGE_SCHEDULED',
      messageId: message._id,
      messageType: messageType.name,
      deliveryTime: deliveryTime,
      scheduledDelivery,
      recipients: messageData.recipients,
      sender: sender.name
    }));
    
    return message;
  }
  
  private calculateDeliveryTime(messageType: PostalMessageType): number {
    switch (messageType.deliveryMode) {
      case DeliveryMode.REALTIME:
        return 0;
        
      case DeliveryMode.SCHEDULED_FIXED:
        return messageType.deliveryTime.fixed || 20;
        
      case DeliveryMode.SCHEDULED_VARIABLE:
      case DeliveryMode.MESSENGER_BOY:
        const [min, max] = messageType.deliveryTime.variable || [10, 30];
        return Math.floor(Math.random() * (max - min + 1)) + min;
        
      case DeliveryMode.DAILY_BATCH:
        return this.calculateNextPostalRound(messageType.deliveryTime.dailyTimes || []);
        
      case DeliveryMode.OFFICIAL:
        const [minOfficial, maxOfficial] = messageType.deliveryTime.variable || [1440, 2880];
        return Math.floor(Math.random() * (maxOfficial - minOfficial + 1)) + minOfficial;
        
      default:
        return 60; // Default 1 hour
    }
  }
  
  private calculateNextPostalRound(dailyTimes: string[]): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const timeStr of dailyTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const deliveryTime = new Date(today);
      deliveryTime.setHours(hours, minutes, 0, 0);
      
      if (deliveryTime > now) {
        return Math.floor((deliveryTime.getTime() - now.getTime()) / 60000); // Minutes until delivery
      }
    }
    
    // Next day first delivery
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [firstHours, firstMinutes] = dailyTimes[0].split(':').map(Number);
    tomorrow.setHours(firstHours, firstMinutes, 0, 0);
    
    return Math.floor((tomorrow.getTime() - now.getTime()) / 60000);
  }
  
  private async createMessageViews(message: OnGameMessage) {
    // Create outbox view for sender
    await OnGameMessageView.create({
      messageId: message._id,
      characterId: message.from,
      viewType: 'outbox',
      read: true, // Sender always "read" their own message
      archived: false,
      starred: false,
      folder: 'sent',
      labels: [],
      deliveryStatus: 'pending'
    });
    
    // Create inbox views for recipients
    for (const recipientId of message.recipients) {
      await OnGameMessageView.create({
        messageId: message._id,
        characterId: recipientId,
        viewType: 'inbox',
        read: false,
        archived: false,
        starred: false,
        folder: 'inbox',
        labels: [],
        deliveryStatus: 'pending'
      });
    }
  }
}
```

### Gmail-Style Message Management

```typescript
class OnGameInboxService {
  
  async getInbox(characterId: string, options: {
    page?: number;
    limit?: number;
    folder?: string;
    unreadOnly?: boolean;
    search?: string;
  } = {}): Promise<{
    messages: OnGameMessageView[];
    total: number;
    unreadCount: number;
  }> {
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    
    const query: any = {
      characterId,
      viewType: 'inbox',
      deleted: false
    };
    
    if (options.folder && options.folder !== 'inbox') {
      query.folder = options.folder;
    }
    
    if (options.unreadOnly) {
      query.read = false;
    }
    
    // Search in message content/subject
    if (options.search) {
      const messages = await OnGameMessageView.find(query)
        .populate({
          path: 'messageId',
          match: {
            $or: [
              { subject: { $regex: options.search, $options: 'i' } },
              { content: { $regex: options.search, $options: 'i' } }
            ]
          }
        });
        
      // Filter out null populated messages
      return {
        messages: messages.filter(view => view.messageId !== null),
        total: messages.length,
        unreadCount: await this.getUnreadCount(characterId)
      };
    }
    
    const [messages, total, unreadCount] = await Promise.all([
      OnGameMessageView.find(query)
        .populate({
          path: 'messageId',
          populate: {
            path: 'from',
            select: 'name'
          }
        })
        .sort({ 'messageId.createdAt': -1 })
        .skip(skip)
        .limit(limit),
        
      OnGameMessageView.countDocuments(query),
      
      this.getUnreadCount(characterId)
    ]);
    
    return { messages, total, unreadCount };
  }
  
  async markAsRead(viewId: string, characterId: string): Promise<OnGameMessageView> {
    const view = await OnGameMessageView.findOneAndUpdate(
      { 
        _id: viewId, 
        characterId,
        viewType: 'inbox'
      },
      { 
        read: true, 
        readAt: new Date() 
      },
      { new: true }
    );
    
    if (!view) throw new Error('Message not found');
    
    // Publish read receipt event
    await redis.publish('ongame:events', JSON.stringify({
      type: 'MESSAGE_READ',
      messageId: view.messageId,
      readBy: characterId,
      readAt: view.readAt
    }));
    
    return view;
  }
  
  async organizeMessage(viewId: string, characterId: string, actions: {
    archive?: boolean;
    star?: boolean;
    folder?: string;
    labels?: string[];
  }): Promise<OnGameMessageView> {
    
    const updateData: any = {};
    
    if (actions.archive !== undefined) updateData.archived = actions.archive;
    if (actions.star !== undefined) updateData.starred = actions.star;
    if (actions.folder) updateData.folder = actions.folder;
    if (actions.labels) updateData.labels = actions.labels;
    
    const view = await OnGameMessageView.findOneAndUpdate(
      { _id: viewId, characterId },
      updateData,
      { new: true }
    );
    
    return view;
  }
  
  async deleteMessage(viewId: string, characterId: string): Promise<void> {
    await OnGameMessageView.findOneAndUpdate(
      { _id: viewId, characterId },
      { deleted: true }
    );
  }
  
  private async getUnreadCount(characterId: string): Promise<number> {
    return OnGameMessageView.countDocuments({
      characterId,
      viewType: 'inbox',
      read: false,
      deleted: false
    });
  }
}
```

## 3. OffGame Chat System

### Telegram-Style Architecture

```typescript
interface OOCChat {
  _id: ObjectId;
  type: 'direct' | 'group';
  name?: string; // For group chats
  description?: string;
  participants: ObjectId[]; // User IDs (not character IDs)
  createdBy: ObjectId;
  createdAt: Date;
  lastActivity: Date;
  
  // Group chat settings
  settings?: {
    allowInvites: boolean;
    messageHistory: boolean;
    notifications: boolean;
  };
}

interface OOCMessage {
  _id: ObjectId;
  chatId: ObjectId;
  sender: ObjectId; // User ID
  senderName: string;
  content: string;
  timestamp: Date;
  
  // Message features
  edited: boolean;
  editedAt?: Date;
  replyTo?: ObjectId; // Message being replied to
  reactions?: MessageReaction[];
  
  // Message type
  messageType: 'text' | 'system' | 'join' | 'leave';
}

interface MessageReaction {
  emoji: string;
  users: ObjectId[];
  count: number;
}

interface TypingIndicator {
  chatId: string;
  userId: string;
  username: string;
  timestamp: Date;
}
```

### Real-Time OffGame Communication

```typescript
class OOCChatManager {
  private io: SocketIOServer;
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(io: SocketIOServer) {
    this.io = io;
  }
  
  async joinOOCChat(socket: Socket, chatId: string, userId: string) {
    // Verify user has access to chat
    const chat = await OOCChat.findOne({
      _id: chatId,
      participants: userId
    });
    
    if (!chat) throw new Error('Chat not found or access denied');
    
    // Join WebSocket room
    await socket.join(`ooc:${chatId}`);
    
    // Load recent message history
    const recentMessages = await OOCMessage.find({ chatId })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('sender', 'username');
      
    socket.emit('ooc:history', {
      chatId,
      messages: recentMessages.reverse(),
      chatInfo: chat
    });
    
    // Notify other participants
    socket.to(`ooc:${chatId}`).emit('ooc:user_joined', {
      userId,
      username: socket.user.username,
      timestamp: new Date()
    });
  }
  
  async sendOOCMessage(chatId: string, senderId: string, content: string, replyTo?: string) {
    // Validate chat access
    const chat = await OOCChat.findOne({
      _id: chatId,
      participants: senderId
    });
    
    if (!chat) throw new Error('Chat access denied');
    
    // Create message
    const message = new OOCMessage({
      chatId,
      sender: senderId,
      senderName: await this.getUserName(senderId),
      content: this.sanitizeContent(content),
      timestamp: new Date(),
      edited: false,
      replyTo: replyTo || null,
      messageType: 'text'
    });
    
    await message.save();
    
    // Broadcast to chat participants
    this.io.to(`ooc:${chatId}`).emit('ooc:message', {
      id: message._id,
      sender: message.senderName,
      senderId: message.sender,
      content: message.content,
      timestamp: message.timestamp,
      replyTo: message.replyTo
    });
    
    // Update chat last activity
    await OOCChat.findByIdAndUpdate(chatId, { 
      lastActivity: new Date() 
    });
    
    // Clear typing indicator for sender
    this.clearTypingIndicator(chatId, senderId);
    
    return message;
  }
  
  handleTyping(socket: Socket, chatId: string, userId: string) {
    const typingKey = `${chatId}:${userId}`;
    
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(typingKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Broadcast typing indicator
    socket.to(`ooc:${chatId}`).emit('ooc:typing', {
      userId,
      username: socket.user.username
    });
    
    // Set timeout to clear typing
    const timeout = setTimeout(() => {
      socket.to(`ooc:${chatId}`).emit('ooc:typing_stopped', { userId });
      this.typingTimeouts.delete(typingKey);
    }, 3000);
    
    this.typingTimeouts.set(typingKey, timeout);
  }
  
  async editOOCMessage(messageId: string, newContent: string, userId: string) {
    const message = await OOCMessage.findOneAndUpdate(
      { 
        _id: messageId, 
        sender: userId,
        messageType: 'text'
      },
      { 
        content: this.sanitizeContent(newContent),
        edited: true,
        editedAt: new Date()
      },
      { new: true }
    );
    
    if (!message) throw new Error('Message not found or cannot be edited');
    
    // Broadcast edit
    this.io.to(`ooc:${message.chatId}`).emit('ooc:message_edited', {
      messageId,
      newContent: message.content,
      editedAt: message.editedAt
    });
    
    return message;
  }
  
  async deleteOOCMessage(messageId: string, userId: string) {
    const message = await OOCMessage.findOne({
      _id: messageId,
      sender: userId
    });
    
    if (!message) throw new Error('Message not found');
    
    // Soft delete - replace with deletion notice
    await OOCMessage.findByIdAndUpdate(messageId, {
      content: '[Message deleted]',
      edited: true,
      editedAt: new Date(),
      messageType: 'system'
    });
    
    this.io.to(`ooc:${message.chatId}`).emit('ooc:message_deleted', { 
      messageId,
      deletedBy: userId,
      deletedAt: new Date()
    });
  }
  
  async addReaction(messageId: string, emoji: string, userId: string) {
    const message = await OOCMessage.findById(messageId);
    if (!message) throw new Error('Message not found');
    
    // Initialize reactions if not exists
    if (!message.reactions) message.reactions = [];
    
    // Find existing reaction for this emoji
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      // Add user to existing reaction
      if (!existingReaction.users.includes(userId)) {
        existingReaction.users.push(userId);
        existingReaction.count = existingReaction.users.length;
      }
    } else {
      // Create new reaction
      message.reactions.push({
        emoji,
        users: [userId],
        count: 1
      });
    }
    
    await message.save();
    
    // Broadcast reaction
    this.io.to(`ooc:${message.chatId}`).emit('ooc:reaction_added', {
      messageId,
      emoji,
      userId,
      reactions: message.reactions
    });
  }
  
  private clearTypingIndicator(chatId: string, userId: string) {
    const typingKey = `${chatId}:${userId}`;
    const timeout = this.typingTimeouts.get(typingKey);
    
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(typingKey);
      
      this.io.to(`ooc:${chatId}`).emit('ooc:typing_stopped', { userId });
    }
  }
}
```

## WebSocket Events Integration

### Unified Event System

```typescript
interface UnifiedMessageEvent {
  system: MessageSystem;
  type: string;
  data: any;
  timestamp: Date;
  priority: MessagePriority;
}

// Event types by system
enum LocationChatEvents {
  MESSAGE = 'location:message',
  CHARACTER_ENTERED = 'location:character_entered',
  CHARACTER_LEFT = 'location:character_left',
  DICE_ROLLED = 'location:dice_rolled',
  ITEM_USED = 'location:item_used'
}

enum OnGameEvents {
  MESSAGE_SCHEDULED = 'ongame:message_scheduled',
  MESSAGE_DELIVERED = 'ongame:message_delivered',
  MESSAGE_READ = 'ongame:message_read',
  POSTAGE_DEDUCTED = 'ongame:postage_deducted',
  POSTAL_ROUND = 'ongame:postal_round'
}

enum OOCEvents {
  MESSAGE = 'ooc:message',
  MESSAGE_EDITED = 'ooc:message_edited',
  MESSAGE_DELETED = 'ooc:message_deleted',
  TYPING = 'ooc:typing',
  TYPING_STOPPED = 'ooc:typing_stopped',
  USER_JOINED = 'ooc:user_joined',
  USER_LEFT = 'ooc:user_left',
  REACTION_ADDED = 'ooc:reaction_added'
}

// Client-side event handlers
class MessagingEventHandler {
  private socket: Socket;
  
  constructor(socket: Socket) {
    this.socket = socket;
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Location Chat Events
    this.socket.on(LocationChatEvents.MESSAGE, (message: LocationMessage) => {
      this.handleLocationMessage(message);
    });
    
    this.socket.on(LocationChatEvents.DICE_ROLLED, (diceResult: DiceRollResult) => {
      this.handleDiceRoll(diceResult);
    });
    
    // OnGame Postal Events
    this.socket.on(OnGameEvents.MESSAGE_DELIVERED, (event) => {
      this.handleMessageDelivered(event);
      this.updateInboxBadge();
      this.showNotification(`📬 ${event.messageType} delivered: ${event.subject}`);
    });
    
    this.socket.on(OnGameEvents.MESSAGE_READ, (event) => {
      this.updateOutboxReadStatus(event.messageId, event.readBy);
    });
    
    this.socket.on(OnGameEvents.POSTAL_ROUND, (event) => {
      this.showPostalRoundNotification(event);
    });
    
    // OffGame Chat Events
    this.socket.on(OOCEvents.MESSAGE, (message) => {
      this.appendOOCMessage(message);
    });
    
    this.socket.on(OOCEvents.TYPING, (data) => {
      this.showTypingIndicator(data.username, data.chatId);
    });
    
    this.socket.on(OOCEvents.TYPING_STOPPED, (data) => {
      this.hideTypingIndicator(data.userId, data.chatId);
    });
    
    this.socket.on(OOCEvents.MESSAGE_EDITED, (data) => {
      this.updateMessageContent(data.messageId, data.newContent);
    });
  }
  
  private handleLocationMessage(message: LocationMessage) {
    const messageContainer = document.getElementById(`location-chat-${message.locationId}`);
    if (!messageContainer) return;
    
    const messageElement = this.createLocationMessageElement(message);
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    // Play sound for different action types
    this.playActionSound(message.actionType);
  }
  
  private handleDiceRoll(diceResult: DiceRollResult) {
    const resultElement = this.createDiceResultElement(diceResult);
    this.displayDiceResult(resultElement);
    
    if (diceResult.success) {
      this.playSuccessSound(diceResult.success);
    }
  }
  
  private handleMessageDelivered(event: any) {
    // Update inbox UI
    this.incrementInboxCount();
    
    // Show desktop notification if enabled
    if (Notification.permission === 'granted') {
      new Notification(`📬 TenpennyNovels`, {
        body: `New ${event.messageType} from ${event.from}: ${event.subject}`,
        icon: '/favicon.ico'
      });
    }
  }
}
```

## API Endpoints

### Game Backend Routes

```typescript
// Location Chat
GET    /game/chat/:locationId/messages    // Get location message history
POST   /game/chat/:locationId/message     // Send location message
GET    /game/chat/:locationId/occupants   // Get characters in location
POST   /game/chat/:locationId/dice        // Roll dice in location
POST   /game/chat/:locationId/whisper     // Send whisper to specific characters

// OnGame Messages (Victorian Postal)
GET    /game/ongame-messages/inbox         // Inbox with pagination, filters
GET    /game/ongame-messages/outbox        // Sent messages
POST   /game/ongame-messages               // Send new message
GET    /game/ongame-messages/:id           // Get message details
PATCH  /game/ongame-messages/:id/read      // Mark message as read
PATCH  /game/ongame-messages/:id/organize  // Archive, star, label message
DELETE /game/ongame-messages/:id           // Delete message view
GET    /game/ongame-messages/types         // Available message types
GET    /game/ongame-messages/statistics    // User postal statistics

// OffGame Chat
GET    /game/ooc-chats                     // List user's chats
POST   /game/ooc-chats                     // Create new chat/group
GET    /game/ooc-chats/:chatId             // Get chat details
GET    /game/ooc-chats/:chatId/messages    // Get chat message history
POST   /game/ooc-chats/:chatId/messages    // Send message
PUT    /game/ooc-chats/:chatId/messages/:messageId  // Edit message
DELETE /game/ooc-chats/:chatId/messages/:messageId  // Delete message
POST   /game/ooc-chats/:chatId/reactions/:messageId // Add reaction
POST   /game/ooc-chats/:chatId/invite      // Invite users to group chat
POST   /game/ooc-chats/:chatId/leave       // Leave group chat
```

## Database Indexing & Performance

### Optimized Database Indexes

```typescript
// Location Messages
await db.collection('location_messages').createIndex({ 
  locationId: 1, 
  timestamp: -1 
}, { name: 'location_messages_location_time' });

await db.collection('location_messages').createIndex({ 
  characterId: 1, 
  timestamp: -1 
}, { name: 'location_messages_character_time' });

await db.collection('location_messages').createIndex({ 
  visibility: 1, 
  locationId: 1,
  timestamp: -1 
}, { name: 'location_messages_visibility' });

// OnGame Messages - Postal System
await db.collection('ongame_messages').createIndex({ 
  scheduledDelivery: 1, 
  isDelivered: 1,
  deliveryMode: 1 
}, { name: 'ongame_messages_delivery_queue' });

await db.collection('ongame_messages').createIndex({ 
  from: 1, 
  createdAt: -1 
}, { name: 'ongame_messages_sender' });

await db.collection('ongame_messages').createIndex({ 
  recipients: 1, 
  createdAt: -1 
}, { name: 'ongame_messages_recipients' });

// OnGame Message Views - Gmail-style management
await db.collection('ongame_message_views').createIndex({ 
  characterId: 1, 
  viewType: 1,
  read: 1,
  deleted: 1
}, { name: 'ongame_views_character_inbox' });

await db.collection('ongame_message_views').createIndex({ 
  characterId: 1, 
  folder: 1,
  archived: 1
}, { name: 'ongame_views_organization' });

// OOC Messages
await db.collection('ooc_messages').createIndex({ 
  chatId: 1, 
  timestamp: -1 
}, { name: 'ooc_messages_chat_time' });

await db.collection('ooc_messages').createIndex({ 
  sender: 1, 
  timestamp: -1 
}, { name: 'ooc_messages_sender' });

await db.collection('ooc_chats').createIndex({ 
  participants: 1, 
  lastActivity: -1 
}, { name: 'ooc_chats_participants' });
```

### Caching Strategy

```typescript
class MessagingCacheManager {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  // Cache recent location messages
  async cacheLocationMessages(locationId: string, messages: LocationMessage[]) {
    const cacheKey = `location:messages:${locationId}`;
    const pipeline = this.redis.pipeline();
    
    // Clear existing cache
    pipeline.del(cacheKey);
    
    // Add messages to list (newest first)
    messages.reverse().forEach(message => {
      pipeline.lpush(cacheKey, JSON.stringify(message));
    });
    
    // Keep only last 100 messages
    pipeline.ltrim(cacheKey, 0, 99);
    
    // Expire cache after 1 hour
    pipeline.expire(cacheKey, 3600);
    
    await pipeline.exec();
  }
  
  // Get cached location messages
  async getCachedLocationMessages(locationId: string, limit: number = 50): Promise<LocationMessage[]> {
    const cacheKey = `location:messages:${locationId}`;
    const cached = await this.redis.lrange(cacheKey, 0, limit - 1);
    
    return cached.map(msg => JSON.parse(msg)).reverse(); // Chronological order
  }
  
  // Cache user inbox count
  async cacheInboxCount(characterId: string, count: number) {
    const cacheKey = `inbox:count:${characterId}`;
    await this.redis.setex(cacheKey, 300, count.toString()); // 5 minutes
  }
  
  // Get cached inbox count
  async getCachedInboxCount(characterId: string): Promise<number | null> {
    const cacheKey = `inbox:count:${characterId}`;
    const cached = await this.redis.get(cacheKey);
    return cached ? parseInt(cached, 10) : null;
  }
  
  // Cache OOC chat participants
  async cacheOOCParticipants(chatId: string, participants: string[]) {
    const cacheKey = `ooc:participants:${chatId}`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify(participants)); // 1 hour
  }
  
  // Invalidate message caches
  async invalidateLocationCache(locationId: string) {
    await this.redis.del(`location:messages:${locationId}`);
  }
  
  async invalidateInboxCache(characterId: string) {
    await this.redis.del(`inbox:count:${characterId}`);
  }
}
```

## Security & Content Moderation

### Message Content Sanitization

```typescript
import xss from 'xss';
import { profanityFilter } from '../utils/profanityFilter';

class MessageSanitizer {
  
  static sanitizeLocationMessage(content: string): string {
    // Basic XSS protection
    const sanitized = xss(content, {
      whiteList: {
        b: [], i: [], u: [], em: [], strong: [], br: []
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style', 'iframe']
    });
    
    // Profanity filter for public messages
    return profanityFilter.clean(sanitized);
  }
  
  static sanitizeOnGameMessage(content: string): string {
    // More permissive for private messages, but still secure
    const sanitized = xss(content, {
      whiteList: {
        p: [], br: [], b: [], i: [], u: [], em: [], strong: [],
        blockquote: [], ul: [], ol: [], li: []
      }
    });
    
    // Light profanity filter
    return profanityFilter.cleanMild(sanitized);
  }
  
  static sanitizeOOCMessage(content: string): string {
    // Moderate filtering for OOC chat
    const sanitized = xss(content, {
      whiteList: {
        b: [], i: [], u: [], code: [], pre: []
      }
    });
    
    return profanityFilter.clean(sanitized);
  }
}
```

### Access Control & Permissions

```typescript
class MessagingAccessControl {
  
  static async canAccessLocation(characterId: string, locationId: string): Promise<boolean> {
    const location = await Location.findById(locationId);
    const character = await Character.findById(characterId);
    
    if (!location || !character) return false;
    
    // Public locations are always accessible
    if (!location.controls?.private) return true;
    
    // Check specific access rules
    if (location.accessRules?.type === 'character_owned') {
      return location.accessRules.ownerId.equals(character._id) ||
             location.accessRules.allowedCharacters?.some(id => id.equals(character._id));
    }
    
    if (location.accessRules?.type === 'corporation') {
      const membership = await CorporationMembership.findOne({
        characterId: character._id,
        corporationId: location.accessRules.corporationId,
        status: 'active'
      });
      return !!membership;
    }
    
    // Staff can access all locations
    return character.roles.some(role => 
      ['master', 'moderatore', 'amministratore'].includes(role)
    );
  }
  
  static async canSendOnGameMessage(senderId: string, messageType: string): Promise<boolean> {
    const character = await Character.findById(senderId);
    const msgType = VICTORIAN_MESSAGE_TYPES.find(t => t.id === messageType);
    
    if (!character || !msgType) return false;
    
    // Check role requirements
    if (msgType.requiresRole) {
      return msgType.requiresRole.some(role => character.roles.includes(role));
    }
    
    return true;
  }
  
  static canModerateChat(userRoles: string[]): boolean {
    return userRoles.some(role => 
      ['moderatore', 'amministratore'].includes(role)
    );
  }
}
```

## Environment Configuration

```bash
# Postal System Configuration
POSTAL_BATCH_DELIVERY_TIMES=09:00,15:00,18:00
POSTAL_EXPRESS_MULTIPLIER=2
POSTAL_MIN_EXPRESS_TIME=5
POSTAL_WORKING_DAYS_ONLY=true

# Chat Configuration
CHAT_MESSAGE_MAX_LENGTH=2000
LOCATION_CHAT_HISTORY_LIMIT=100
OOC_CHAT_HISTORY_LIMIT=50
TYPING_TIMEOUT=3000

# WebSocket Configuration
WEBSOCKET_HEARTBEAT_INTERVAL=25000
WEBSOCKET_TIMEOUT=60000
WEBSOCKET_MAX_CONNECTIONS_PER_USER=5

# Moderation Settings
PROFANITY_FILTER_LEVEL=moderate
AUTO_MODERATE_LOCATION_CHAT=true
REQUIRE_APPROVAL_FOR_OOC_GROUPS=false

# Performance Settings
MESSAGE_CACHE_TTL=3600
INBOX_COUNT_CACHE_TTL=300
LOCATION_MESSAGE_CACHE_SIZE=100
```

Il sistema di messaggistica di TenpennyNovels fornisce un'esperienza di comunicazione completa e immersiva che supporta sia il gameplay in-character attraverso meccaniche postali vittoriane autentiche, sia la comunicazione fuori personaggio per coordinamento e socializzazione, il tutto integrato in un'architettura WebSocket robusta e performante.