import { Server as SocketIOServer } from 'socket.io';
import { redis } from '@config/runtime/redis';
import { logger } from '../utils/logger';

export class RedisEventManager {
  private subscriber = redis.getSubscriber();
  private publisher = redis.getPublisher();
  
  constructor(private io: SocketIOServer) {}
  
  async initialize(): Promise<void> {
    try {
      // Subscribe to all relevant Redis channels using Redis v4+ API with individual handlers
      await this.subscriber.subscribe('user:events', (message) => {
        try {
          this.handleUserEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel user:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('character:events', (message) => {
        try {
          this.handleCharacterEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel character:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('character:review_completed', (message) => {
        try {
          this.handleCharacterReview(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel character:review_completed:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('game:events', (message) => {
        try {
          this.handleGameEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel game:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });

      await this.subscriber.subscribe('game:weather_changed', (message) => {
        try {
          this.handleWeatherChanged(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel game:weather_changed:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });

      await this.subscriber.subscribe('location:events', (message) => {
        try {
          this.handleLocationEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel location:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('corporation:events', (message) => {
        try {
          this.handleCorporationEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel corporation:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('relationship:events', (message) => {
        try {
          this.handleRelationshipEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel relationship:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      await this.subscriber.subscribe('ticket:events', (message) => {
        try {
          this.handleTicketEvents(message);
        } catch (error: any) {
          logger.error(`Error processing Redis message from channel ticket:events:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
          });
        }
      });
      
      logger.info('Redis Event Manager initialized and subscribed to channels');
    } catch (error: any) {
      logger.error('Failed to initialize Redis Event Manager:', error);
      throw error;
    }
  }
  
  /**
   * Publish an event to Redis
   */
  async publishEvent(channel: string, event: any): Promise<void> {
    try {
      const eventData = {
        ...event,
        timestamp: new Date().toISOString(),
        source: 'game-backend'
      };
      
      await this.publisher.publish(channel, JSON.stringify(eventData));
      logger.debug(`Published event to ${channel}:`, eventData);
    } catch (error: any) {
      logger.error(`Failed to publish event to ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Handle user-related events
   */
  private async handleUserEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received user event:', event);
      
      switch (event.type) {
        case 'user_login':
          await this.handleUserLogin(event);
          break;
          
        case 'user_logout':
          await this.handleUserLogout(event);
          break;
          
        case 'user_character_selected':
          await this.handleCharacterSelection(event);
          break;
          
        default:
          logger.debug(`Unhandled user event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling user event:', error);
    }
  }
  
  /**
   * Handle character-related events
   */
  private async handleCharacterEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received character event:', event);
      
      switch (event.type) {
        case 'character_created':
          await this.handleCharacterCreated(event);
          break;
          
        case 'character_approved':
          await this.handleCharacterApproved(event);
          break;
          
        case 'character_rejected':
          await this.handleCharacterRejected(event);
          break;
          
        case 'character_stats_changed':
          await this.handleCharacterStatsChanged(event);
          break;
          
        default:
          logger.debug(`Unhandled character event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling character event:', error);
    }
  }

  /**
   * Handle character review completed events from management backend
   */
  private async handleCharacterReview(message: string): Promise<void> {
    try {
      // Validate message is a string and not empty
      if (typeof message !== 'string' || !message.trim()) {
        logger.warn('Character review event: Invalid message format', { messageType: typeof message, messageLength: message?.length });
        return;
      }

      let event;
      try {
        event = JSON.parse(message);
      } catch (jsonError) {
        logger.error('Character review event: Invalid JSON', {
          error: jsonError instanceof Error ? jsonError.message : String(jsonError),
          messagePreview: message.substring(0, 200)
        });
        return;
      }

      logger.info('Received character review event:', event);

      const { characterId, characterName, action, note, reviewedByUsername, adminCookies } = event;

      if (!characterId || !action || !reviewedByUsername) {
        logger.warn('Invalid character review event - missing required fields', { 
          event, 
          hasCharacterId: !!characterId,
          hasAction: !!action,
          hasReviewedByUsername: !!reviewedByUsername
        });
        return;
      }

      if (!adminCookies?.auth_token || !adminCookies?.character_context) {
        logger.warn('Invalid character review event - missing admin cookies', { 
          hasAuthToken: !!adminCookies?.auth_token,
          hasCharacterContext: !!adminCookies?.character_context
        });
        return;
      }

      // Send off-game message to the character
      await this.sendCharacterReviewMessage(characterId, characterName, action, note, reviewedByUsername);

      // Send WebSocket event to notify character data refresh
      await this.notifyCharacterStatusChange(characterId, characterName, action);

    } catch (error: any) {
      logger.error('Error handling character review event:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        messagePreview: typeof message === 'string' ? message.substring(0, 100) : 'Non-string message'
      });
    }
  }

  /**
   * Send off-game message for character approval/rejection using existing API endpoints
   */
  private async sendCharacterReviewMessage(
    characterId: string, 
    characterName: string, 
    action: 'approve' | 'reject', 
    note: string, 
    reviewedByUsername: string
  ): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      const { User } = await import('@database/models/User');

      // Find the reviewed character
      const targetCharacter = await Character.findById(characterId).populate('userId');
      if (!targetCharacter) {
        logger.warn(`Character ${characterId} not found for review message`);
        return;
      }

      // Find the admin who reviewed (by username)
      const adminUser = await User.findOne({ username: reviewedByUsername });
      if (!adminUser) {
        logger.warn(`Admin user ${reviewedByUsername} not found for review message`);
        return;
      }

      // Find admin's character (prefer master/amministratore roles)
      const adminCharacter = await Character.findOne({ 
        userId: adminUser._id,
        status: 'APPROVED',
        gameplayRoles: { $in: ['master', 'amministratore', 'moderatore'] }
      }).sort({ gameplayRoles: -1 }); // Prioritize by role hierarchy

      if (!adminCharacter) {
        logger.warn(`No admin character found for user ${reviewedByUsername}`);
        return;
      }

      // Create the message content
      let messageContent: string;
      if (action === 'approve') {
        messageContent = `🎉 Abbiamo verificato il tuo personaggio "${characterName}" ed è stato APPROVATO!\n\nOra puoi iniziare a giocare e divertirti nella Londra vittoriana. Benvenuto/a nel mondo di TenpennyNovels!`;
        if (note && note.trim()) {
          messageContent += `\n\nNota: ${note}`;
        }
      } else {
        messageContent = `📝 Abbiamo verificato il tuo personaggio "${characterName}" ed è stato RESPINTO.\n\nIl motivo è il seguente: ${note}\n\nPuoi modificare il personaggio e sottoporlo nuovamente per l'approvazione. Se hai domande, rispondi pure a questo messaggio!`;
      }

      // ✅ Use direct service calls (no HTTP overhead)
      await this.sendOffGameMessage(
        adminCharacter._id.toString(),
        targetCharacter._id.toString(),
        messageContent
      );

      logger.info(`Character review message sent via direct service call`, {
        fromCharacter: adminCharacter.name,
        toCharacter: targetCharacter.name,
        action,
        messageLength: messageContent.length
      });

    } catch (error: any) {
      logger.error('Error sending character review message via API:', error);
    }
  }

  /**
   * Send off-game message using DIRECT service calls (no HTTP overhead)
   * ✅ REFACTORED: No longer requires ADMIN_AUTH_TOKEN or self-HTTP-calls
   */
  private async sendOffGameMessage(
    fromCharacterId: string,
    toCharacterId: string,
    messageContent: string
  ): Promise<void> {
    try {
      // ✅ Import service directly (same backend, no HTTP needed)
      const { OffGameChatService } = await import('./OffGameChatService');

      // 1. Create or get existing direct chat
      const chat = await OffGameChatService.createOrGetDirectChat({
        fromCharacterId,
        toCharacterId
      });

      logger.info('Direct chat created/found for review message', {
        chatId: chat._id.toString(),
        fromCharacter: fromCharacterId,
        toCharacter: toCharacterId
      });

      // 2. Send the message
      const message = await OffGameChatService.sendMessage({
        chatId: chat._id.toString(),
        fromCharacterId,
        content: messageContent,
        messageType: 'system' // System message for character review notifications
      });

      logger.info('Review message sent successfully via direct service call', {
        chatId: chat._id.toString(),
        messageId: message?._id.toString(),
        contentLength: messageContent.length
      });

      // 3. Emit WebSocket event for real-time delivery
      const participants = await OffGameChatService.getChatParticipants(chat._id.toString());

      const notificationData = {
        chatId: chat._id.toString(),
        messageId: message?._id.toString(),
        senderId: fromCharacterId,
        content: messageContent,
        messageType: 'system' as const,
        timestamp: message?.sentAt,
        isRead: false
      };

      // Send notification to each participant's personal room (except sender)
      for (const participant of participants) {
        if (participant.characterId.toString() !== fromCharacterId) {
          const participantRoom = `character_${participant.characterId}`;
          this.io.to(participantRoom).emit('offgame_message_received', notificationData);
        }
      }

      const notifiedParticipants = participants.filter(p => p.characterId.toString() !== fromCharacterId);
      logger.info(`OffGame message broadcasted to ${notifiedParticipants.length} participants (excluding sender)`, {
        chatId: chat._id.toString(),
        sender: fromCharacterId,
        notifiedParticipants: notifiedParticipants.map(p => p.characterId.toString())
      });

    } catch (error: any) {
      logger.error('Error in sendOffGameMessage:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fromCharacterId,
        toCharacterId
      });
      throw error;
    }
  }

  /**
   * Notify character about status change to trigger frontend data refresh
   */
  private async notifyCharacterStatusChange(
    characterId: string,
    characterName: string,
    action: 'approve' | 'reject'
  ): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      
      // Get updated character to find the user
      const character = await Character.findById(characterId).populate('userId');
      if (!character || !character.userId) {
        logger.warn(`Character ${characterId} or userId not found for status change notification`);
        return;
      }

      const userId = character.userId._id ? character.userId._id.toString() : character.userId.toString();
      
      // Send WebSocket event to the specific character/user to refresh data
      this.io.to(`user_${userId}`).emit('character_status_changed', {
        type: 'character_status_changed',
        characterId: characterId,
        characterName: characterName,
        action: action,
        newStatus: action === 'approve' ? 'APPROVED' : 'DRAFT',
        timestamp: new Date().toISOString(),
        message: action === 'approve' 
          ? 'Il tuo personaggio è stato approvato! I dati sono stati aggiornati.' 
          : 'Il tuo personaggio è stato respinto. Puoi modificarlo e risubmettere.'
      });

      logger.info('Character status change notification sent', {
        characterId,
        characterName,
        userId,
        action,
        newStatus: action === 'approve' ? 'APPROVED' : 'DRAFT'
      });

    } catch (error: any) {
      logger.error('Error sending character status change notification:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        characterId,
        action
      });
    }
  }
  
  /**
   * Handle game-related events
   */
  private async handleGameEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received game event:', event);

      switch (event.type) {
        case 'player_action':
          await this.handlePlayerAction(event);
          break;

        case 'location_change':
          await this.handleLocationChange(event);
          break;

        case 'dice_roll':
          await this.handleDiceRoll(event);
          break;

        case 'item_used':
          await this.handleItemUsed(event);
          break;

        default:
          logger.debug(`Unhandled game event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling game event:', error);
    }
  }

  /**
   * Handle weather change events
   * Broadcasts to all connected clients when master advances game time
   */
  private async handleWeatherChanged(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.info('🌤️ Received weather_changed event:', {
        campaignId: event.campaignId,
        condition: event.weather?.currentCondition,
        temperature: event.weather?.temperature,
        moonPhase: event.weather?.moonPhase,
        gameDate: event.gameDate
      });

      // Broadcast weather change to ALL clients (global event)
      // All players in the campaign see the same weather
      this.io.emit('weather_changed', {
        weather: {
          currentCondition: event.weather?.currentCondition,
          temperature: event.weather?.temperature,
          moonPhase: event.weather?.moonPhase
        },
        gameDate: event.gameDate,
        timestamp: new Date().toISOString()
      });

      logger.info('✅ Weather change broadcasted to all clients');
    } catch (error: any) {
      logger.error('Error handling weather changed event:', error);
    }
  }

  /**
   * Handle location-related events
   */
  private async handleLocationEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received location event:', event);
      
      switch (event.type) {
        case 'player_entered_location':
          await this.handlePlayerEnteredLocation(event);
          break;
          
        case 'player_left_location':
          await this.handlePlayerLeftLocation(event);
          break;
          
        case 'location_chat_message':
          await this.handleLocationChatMessage(event);
          break;
          
        case 'character_moved':
          await this.handleCharacterMoved(event);
          break;
          
        case 'globalPresence_update':
          await this.handleGlobalPresenceUpdate(event);
          break;
          
        case 'globalPresence_update_single':
          await this.handleGlobalPresenceUpdateSingle(event);
          break;
          
        default:
          logger.debug(`Unhandled location event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling location event:', error);
    }
  }
  
  /**
   * Handle corporation-related events
   */
  private async handleCorporationEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received corporation event:', event);
      
      switch (event.type) {
        case 'corporation_member_joined':
        case 'corporation_member_left':
        case 'corporation_salary_paid':
          // Notify relevant users about corporation changes
          await this.notifyGroupMembers('corporation', event.corporationId, event);
          break;
          
        default:
          logger.debug(`Unhandled corporation event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling corporation event:', error);
    }
  }
  
  /**
   * Handle relationship-related events
   */
  private async handleRelationshipEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received relationship event:', event);
      
      switch (event.type) {
        case 'relationship_proposed':
          await this.handleRelationshipProposed(event);
          break;
          
        case 'relationship_accepted':
        case 'relationship_rejected':
          await this.handleRelationshipResponse(event);
          break;
          
        default:
          logger.debug(`Unhandled relationship event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling relationship event:', error);
    }
  }

  /**
   * Handle ticket-related events
   */
  private async handleTicketEvents(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      logger.debug('Received ticket event:', event);
      
      // Support both 'type' (from Game Backend) and 'eventType' (from Management Backend)
      const eventType = event.type || event.eventType;
      
      switch (eventType) {
        case 'ticket_created':
          await this.handleTicketCreated(event);
          break;
          
        case 'ticket_assigned':
          await this.handleTicketAssigned(event);
          break;
          
        case 'ticket_reassigned':
          await this.handleTicketReassigned(event);
          break;
          
        case 'ticket_transferred':
          await this.handleTicketTransferred(event);
          break;
          
        case 'ticket_message':
          await this.handleTicketMessage(event);
          break;
          
        case 'ticket_closed':
          await this.handleTicketClosed(event);
          break;
          
        case 'ticket_reopened':
          await this.handleTicketReopened(event);
          break;
          
        case 'ticket_escalated':
          await this.handleTicketEscalated(event);
          break;
          
        default:
          logger.debug(`Unhandled ticket event type: ${eventType}`);
      }
    } catch (error: any) {
      logger.error('Error handling ticket event:', error);
    }
  }
  
  
  // Event handler implementations
  
  private async handleUserLogin(event: any): Promise<void> {
    // Notify about user coming online
    this.io.emit('user_status_change', {
      userId: event.userId,
      username: event.username,
      status: 'online',
      timestamp: event.timestamp
    });
  }
  
  private async handleUserLogout(event: any): Promise<void> {
    // Notify about user going offline
    this.io.emit('user_status_change', {
      userId: event.userId,
      username: event.username,
      status: 'offline',
      timestamp: event.timestamp
    });
  }
  
  private async handleCharacterSelection(event: any): Promise<void> {
    // Notify about character becoming active
    this.io.emit('character_active', {
      userId: event.userId,
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });
  }
  
  private async handleCharacterCreated(event: any): Promise<void> {
    // Notify staff about new character pending approval
    this.io.to('staff').emit('character_pending_approval', {
      characterId: event.characterId,
      characterName: event.characterName,
      userId: event.userId,
      timestamp: event.timestamp
    });
  }
  
  private async handleCharacterApproved(event: any): Promise<void> {
    // Notify character owner about approval
    this.io.to(`user_${event.userId}`).emit('character_approved', {
      characterId: event.characterId,
      characterName: event.characterName,
      approvedBy: event.approvedBy,
      timestamp: event.timestamp
    });
  }
  
  private async handleCharacterRejected(event: any): Promise<void> {
    // Notify character owner about rejection
    this.io.to(`user_${event.userId}`).emit('character_rejected', {
      characterId: event.characterId,
      characterName: event.characterName,
      reason: event.reason,
      rejectedBy: event.rejectedBy,
      timestamp: event.timestamp
    });
  }
  
  private async handleCharacterStatsChanged(event: any): Promise<void> {
    // Trigger corporation membership checks
    await this.publishEvent('corporation:events', {
      type: 'check_automatic_memberships',
      characterId: event.characterId,
      triggeredBy: 'stats_change'
    });
  }
  
  private async handlePlayerAction(event: any): Promise<void> {
  }
  
  private async handleLocationChange(event: any): Promise<void> {
    // Update location occupancy
    this.io.to(`location_${event.fromLocationId}`).emit('player_left', {
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });
    
    this.io.to(`location_${event.toLocationId}`).emit('player_entered', {
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });
  }
  
  private async handleDiceRoll(event: any): Promise<void> {
    // Broadcast dice roll result to location
    this.io.to(`location_${event.locationId}`).emit('dice_roll_result', {
      characterId: event.characterId,
      characterName: event.characterName,
      diceResult: event.result,
      timestamp: event.timestamp
    });
  }
  
  private async handleItemUsed(event: any): Promise<void> {
    // Broadcast item usage to location if public
    if (event.isPublic) {
      this.io.to(`location_${event.locationId}`).emit('item_used', {
        characterId: event.characterId,
        characterName: event.characterName,
        itemName: event.itemName,
        effect: event.effect,
        timestamp: event.timestamp
      });
    }
  }
  
  private async handlePlayerEnteredLocation(event: any): Promise<void> {
    // Add player to location room
    const userSocket = await this.findUserSocket(event.userId);
    if (userSocket) {
      await userSocket.join(`location_${event.locationId}`);
    }
  }
  
  private async handlePlayerLeftLocation(event: any): Promise<void> {
    // Remove player from location room
    const userSocket = await this.findUserSocket(event.userId);
    if (userSocket) {
      await userSocket.leave(`location_${event.locationId}`);
    }
  }
  
  private async handleLocationChatMessage(event: any): Promise<void> {
    // Broadcast chat message to location room
    this.io.to(`location_${event.locationId}`).emit('chat_message', event.message);
  }
  
  private async handleCharacterMoved(event: any): Promise<void> {
    logger.info('🚀 RedisEventManager: Handling character_moved event', event);
    
    // Find the character's WebSocket connection
    const characterSocket = await this.findCharacterSocket(event.characterId);
    if (!characterSocket) {
      logger.warn('❌ RedisEventManager: Character socket not found for character_moved event', {
        characterId: event.characterId,
        characterName: event.characterName
      });
      return;
    }
    
    // If character moved to a new location (not parked at London)
    if (event.newLocationId) {
      // Get list of characters already in this location from WebSocket rooms
      const socketsInLocation = await this.io.in(`location_${event.newLocationId}`).fetchSockets();
      const presentCharacters = socketsInLocation
        .filter(s => s.data.character && s.data.character.characterId !== event.characterId) // Exclude the character who just moved
        .map(s => ({
          characterId: s.data.character.characterId,
          characterName: s.data.character.characterName,
          locationId: event.newLocationId
        }));
      
      logger.info('🚀 RedisEventManager: Sending location_joined event to character', {
        characterId: event.characterId,
        locationId: event.newLocationId,
        locationName: event.locationName,
        presentCharactersCount: presentCharacters.length
      });
      
      // Send location_joined event to trigger auto-redirect
      characterSocket.emit('location_joined', {
        locationId: event.newLocationId,
        locationName: event.locationName,
        timestamp: event.timestamp,
        presentCharacters: presentCharacters
      });
      
      // ✅ ROOM-BASED BROADCASTS: Notify only relevant location rooms
      if (event.oldLocationId) {
        console.log(`📤 RedisEventManager: Broadcasting player_left to room location_${event.oldLocationId}`);
        this.io.to(`location_${event.oldLocationId}`).emit('player_left', {
          characterId: event.characterId,
          characterName: event.characterName,
          locationId: event.oldLocationId,
          timestamp: event.timestamp
        });
      }

      console.log(`📤 RedisEventManager: Broadcasting player_entered to room location_${event.newLocationId}`);
      this.io.to(`location_${event.newLocationId}`).emit('player_entered', {
        characterId: event.characterId,
        characterName: event.characterName,
        locationId: event.newLocationId,
        timestamp: event.timestamp
      });

      // ✅ GLOBAL BROADCAST: Notify ALL clients about character movement (real-time presence)
      // ⚠️ Scalability trade-off: O(N²) broadcasts, acceptable for <200 concurrent users
      console.log(`📤 RedisEventManager: Broadcasting global_presence_update to ALL clients`);
      this.io.emit('global_presence_update', {
        type: 'character_moved',
        characterId: event.characterId,
        characterName: event.characterName,
        oldLocationId: event.oldLocationId,
        newLocationId: event.newLocationId,
        locationName: event.locationName,
        timestamp: event.timestamp
      });
    }
    
    logger.info('✅ RedisEventManager: character_moved event handled successfully');
  }
  
  private async handleGlobalPresenceUpdate(event: any): Promise<void> {
    logger.info('🌍 RedisEventManager: Handling globalPresence_update event', {
      characterCount: event.globalPresence?.length,
      timestamp: event.timestamp
    });
    
    // Broadcast the complete globalPresence data to all clients
    // This ensures all clients have the most up-to-date presence information
    this.io.emit('global_presence_update', {
      type: 'full_update',
      globalPresence: event.globalPresence,
      timestamp: event.timestamp
    });
    
    logger.info('✅ RedisEventManager: globalPresence_update broadcasted to all clients');
  }
  
  private async handleGlobalPresenceUpdateSingle(event: any): Promise<void> {
    logger.info('🎯 RedisEventManager: Handling globalPresence_update_single event', {
      targetCharacterId: event.characterId,
      characterCount: event.globalPresence?.length,
      timestamp: event.timestamp
    });
    
    // Find the specific character's WebSocket connection
    const characterSocket = await this.findCharacterSocket(event.characterId);
    if (!characterSocket) {
      logger.warn('❌ RedisEventManager: Character socket not found for single globalPresence update', {
        characterId: event.characterId
      });
      return;
    }
    
    // Send globalPresence update ONLY to this specific character
    characterSocket.emit('global_presence_update', {
      type: 'full_update',
      globalPresence: event.globalPresence,
      timestamp: event.timestamp
    });
    
    logger.info('✅ RedisEventManager: globalPresence_update sent to single client', {
      characterId: event.characterId
    });
  }
  
  private async handleRelationshipProposed(event: any): Promise<void> {
    // Notify target character about relationship proposal
    this.io.to(`user_${event.toUserId}`).emit('relationship_proposal', {
      fromCharacterId: event.fromCharacterId,
      fromCharacterName: event.fromCharacterName,
      relationshipType: event.relationshipType,
      proposalId: event.proposalId,
      message: event.message,
      timestamp: event.timestamp
    });
  }
  
  private async handleRelationshipResponse(event: any): Promise<void> {
    // Notify proposer about relationship response
    this.io.to(`user_${event.fromUserId}`).emit('relationship_response', {
      toCharacterId: event.toCharacterId,
      toCharacterName: event.toCharacterName,
      relationshipType: event.relationshipType,
      accepted: event.type === 'relationship_accepted',
      message: event.message,
      timestamp: event.timestamp
    });
  }

  // Ticket event handlers

  private async handleTicketCreated(event: any): Promise<void> {
    logger.info('Handling ticket_created event:', {
      ticketId: event.ticketId,
      category: event.category,
      department: event.department,
      priority: event.priority
    });

    // Notify all staff members about new ticket
    this.io.to('staff').emit('ticket_created', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      timestamp: event.timestamp
    });

    // Notify specific department staff
    this.io.to(`staff_${event.department}`).emit('ticket_created_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      timestamp: event.timestamp
    });
  }

  private async handleTicketAssigned(event: any): Promise<void> {
    logger.info('Handling ticket_assigned event:', {
      ticketId: event.ticketId,
      assignedTo: event.assignedTo?.name
    });

    // Notify character about assignment (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_assigned', {
          ticketId: event.ticketId,
          title: event.title,
          assignedTo: event.assignedTo,
          assignedAt: event.assignedAt,
          timestamp: event.timestamp
        });
      }
    }

    // Notify assigned staff member
    if (event.assignedTo?.id) {
      this.io.to(`user_${event.assignedTo.id}`).emit('ticket_assigned_to_you', {
        ticketId: event.ticketId,
        title: event.title,
        category: event.category,
        categoryLabel: event.categoryLabel,
        priority: event.priority,
        department: event.department,
        createdBy: event.createdBy,
        assignedAt: event.assignedAt,
        timestamp: event.timestamp
      });
    }

    // Notify other staff members about assignment
    this.io.to('staff').emit('ticket_assignment_updated', {
      ticketId: event.ticketId,
      title: event.title,
      assignedTo: event.assignedTo,
      timestamp: event.timestamp
    });
  }

  private async handleTicketReassigned(event: any): Promise<void> {
    logger.info('Handling ticket_reassigned event:', {
      ticketId: event.ticketId,
      fromStaff: event.reassignment?.fromStaff?.name,
      toStaff: event.reassignment?.toStaff?.name
    });

    // Notify character about reassignment (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_reassigned', {
          ticketId: event.ticketId,
          title: event.title,
          reassignment: event.reassignment,
          timestamp: event.timestamp
        });
      }
    }

    // Notify old staff member
    if (event.reassignment?.fromStaff?.id) {
      this.io.to(`user_${event.reassignment.fromStaff.id}`).emit('ticket_reassigned_from_you', {
        ticketId: event.ticketId,
        title: event.title,
        reassignedTo: event.reassignment.toStaff,
        reason: event.reassignment.reason,
        timestamp: event.timestamp
      });
    }

    // Notify new staff member
    if (event.reassignment?.toStaff?.id) {
      this.io.to(`user_${event.reassignment.toStaff.id}`).emit('ticket_reassigned_to_you', {
        ticketId: event.ticketId,
        title: event.title,
        category: event.category,
        categoryLabel: event.categoryLabel,
        priority: event.priority,
        department: event.department,
        createdBy: event.createdBy,
        reassignedFrom: event.reassignment.fromStaff,
        reason: event.reassignment.reason,
        timestamp: event.timestamp
      });
    }
  }

  private async handleTicketTransferred(event: any): Promise<void> {
    logger.info('Handling ticket_transferred event:', {
      ticketId: event.ticketId,
      fromDepartment: event.transfer?.fromDepartment,
      toDepartment: event.transfer?.toDepartment
    });

    // Notify character about department transfer (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_transferred', {
          ticketId: event.ticketId,
          title: event.title,
          transfer: event.transfer,
          timestamp: event.timestamp
        });
      }
    }

    // Notify old department staff
    this.io.to(`staff_${event.transfer.fromDepartment}`).emit('ticket_transferred_from_department', {
      ticketId: event.ticketId,
      title: event.title,
      transfer: event.transfer,
      timestamp: event.timestamp
    });

    // Notify new department staff
    this.io.to(`staff_${event.transfer.toDepartment}`).emit('ticket_transferred_to_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      transfer: event.transfer,
      timestamp: event.timestamp
    });
  }

  private async handleTicketMessage(event: any): Promise<void> {
    logger.info('Handling ticket_message event:', {
      ticketId: event.ticketId,
      senderType: event.sender?.type,
      senderName: event.sender?.name
    });

    if (event.sender?.type === 'character') {
      // Character sent a message - notify staff
      this.io.to('staff').emit('ticket_message_from_character', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        content: event.content,
        sender: event.sender,
        sentAt: event.sentAt,
        ticketTitle: event.ticketTitle,
        department: event.department,
        timestamp: event.timestamp
      });

      // Specific notification to department
      this.io.to(`staff_${event.department}`).emit('ticket_message_character_department', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        content: event.content,
        sender: event.sender,
        sentAt: event.sentAt,
        ticketTitle: event.ticketTitle,
        department: event.department,
        timestamp: event.timestamp
      });

    } else if (event.sender?.type === 'staff') {
      // Staff sent a message - notify character
      if (event.createdBy?.id) {
        const characterSocket = await this.findCharacterSocket(event.createdBy.id);
        if (characterSocket) {
          characterSocket.emit('ticket_message_from_staff', {
            ticketId: event.ticketId,
            messageId: event.messageId,
            content: event.content,
            sender: event.sender,
            sentAt: event.sentAt,
            ticketTitle: event.ticketTitle,
            isInternal: event.isInternal || false,
            timestamp: event.timestamp
          });
        }
      }

      // Also notify other staff members (for coordination)
      this.io.to('staff').emit('ticket_message_staff_update', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        sender: event.sender,
        sentAt: event.sentAt,
        isInternal: event.isInternal || false,
        timestamp: event.timestamp
      });
    }
  }

  private async handleTicketClosed(event: any): Promise<void> {
    logger.info('Handling ticket_closed event:', {
      ticketId: event.ticketId,
      closedBy: event.closedBy?.name
    });

    // Notify character about ticket closure
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_closed', {
          ticketId: event.ticketId,
          title: event.title,
          closedBy: event.closedBy,
          closedAt: event.closedAt,
          finalMessage: event.finalMessage,
          timestamp: event.timestamp
        });
      }
    }

    // Notify staff about ticket closure
    this.io.to('staff').emit('ticket_closed_update', {
      ticketId: event.ticketId,
      title: event.title,
      closedBy: event.closedBy,
      closedAt: event.closedAt,
      timestamp: event.timestamp
    });
  }

  private async handleTicketReopened(event: any): Promise<void> {
    logger.info('Handling ticket_reopened event:', {
      ticketId: event.ticketId,
      reopenedBy: event.reopenedBy?.name
    });

    // Notify all staff about ticket reopening
    this.io.to('staff').emit('ticket_reopened', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      reopenedBy: event.reopenedBy,
      reason: event.reason,
      timestamp: event.timestamp
    });

    // Notify specific department staff
    this.io.to(`staff_${event.department}`).emit('ticket_reopened_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      reopenedBy: event.reopenedBy,
      reason: event.reason,
      timestamp: event.timestamp
    });
  }

  private async handleTicketEscalated(event: any): Promise<void> {
    logger.info('Handling ticket_escalated event:', {
      ticketId: event.ticketId,
      escalationLevel: event.escalation?.toLevel,
      reason: event.escalation?.reason
    });

    // Notify character about escalation (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_escalated', {
          ticketId: event.ticketId,
          title: event.title,
          escalation: event.escalation,
          timestamp: event.timestamp
        });
      }
    }

    // Notify all staff about escalation with high priority
    this.io.to('staff').emit('ticket_escalated', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      escalation: event.escalation,
      timestamp: event.timestamp
    });

    // Notify specific department staff with extra urgency
    this.io.to(`staff_${event.department}`).emit('ticket_escalated_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      escalation: event.escalation,
      timestamp: event.timestamp
    });

    // Notify leadership/admin about escalated tickets
    if (event.escalation?.toLevel >= 2) {
      this.io.to('staff_leadership').emit('critical_ticket_escalated', {
        ticketId: event.ticketId,
        title: event.title,
        escalation: event.escalation,
        timestamp: event.timestamp
      });
    }
  }
  
  
  // Utility methods
  
  private async findUserSocket(userId: string): Promise<any> {
    const sockets = await this.io.fetchSockets();
    return sockets.find(socket => socket.data.userId === userId);
  }
  
  private async findCharacterSocket(characterId: string): Promise<any> {
    const sockets = await this.io.fetchSockets();
    logger.info('🔍 findCharacterSocket: Searching for character socket', {
      targetCharacterId: characterId,
      totalSockets: sockets.length,
      socketsWithCharacter: sockets.filter(s => s.data.character).map(s => ({
        characterId: s.data.character.characterId,
        characterName: s.data.character.characterName
      }))
    });
    
    const foundSocket = sockets.find(socket => socket.data.character?.characterId === characterId);
    logger.info('🔍 findCharacterSocket: Search result', {
      characterId,
      found: !!foundSocket
    });
    
    return foundSocket;
  }
  
  private async notifyGroupMembers(groupType: string, groupId: string, event: any): Promise<void> {
    this.io.to(`${groupType}_${groupId}`).emit(`${groupType}_event`, event);
  }
}