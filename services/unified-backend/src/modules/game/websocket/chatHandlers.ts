import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../logger';
import { Chat, Location } from '@database/models';
import { OffGameChat } from '@features/offGameMessages/api';

// Chat action types as defined in CLAUDE.md
export type ActionType = 
  | 'standard'
  | 'master'
  | 'moderation'
  | 'whisper'
  | 'ooc'
  | 'dice_generic'
  | 'dice_action'
  | 'item_usage';

export interface Chat {
  actionType: ActionType;
  characterId: string;
  characterName: string;
  content: string;
  locationId: string;
  timestamp: Date;
  visibility: 'public' | 'whisper' | 'master_only';
  diceResult?: {
    dice: string;
    result: number;
    success?: boolean;
  };
  itemEffect?: {
    itemId: string;
    itemName: string;
    effect: string;
  };
  targetCharacters?: string[]; // For whispers
  characterRoles: string[]; // Sender's gameplay roles
}

export interface ChatActionRequest {
  actionType: ActionType;
  content: string;
  locationId: string;
  targetCharacters?: string[]; // For whispers
  diceSpec?: string; // e.g., "1d100", "2d6+3"
  itemId?: string; // For item usage
}

/**
 * Setup chat-related WebSocket handlers
 */
export function setupChatHandlers(socket: Socket, io: SocketIOServer): void {
  
  /**
   * Handle location chat actions
   */
  // location_action listener removed - use HTTP endpoints instead
  
  /**
   * Join a location room
   */
  socket.on('join_location', async (locationId: string) => {
    try {
      if (!locationId || typeof locationId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(locationId)) {
        socket.emit('error', { code: 'INVALID_LOCATION_ID', message: 'ID location non valido' });
        return;
      }

      const character = socket.data.character;
      
      if (!character) {
        socket.emit('error', { code: 'CHARACTER_REQUIRED', message: 'Contesto personaggio richiesto' });
        return;
      }
      
      // Leave previous location if any
      if (socket.data.currentLocationId) {
        socket.leave(`location_${socket.data.currentLocationId}`);
        
        // Notify others character left previous location
        const playerLeftEvent = {
          characterId: character.characterId,
          characterName: character.characterName,
          locationId: socket.data.currentLocationId,
          timestamp: new Date().toISOString()
        };
        
        // ✅ ROOM-BASED: Only notify players in the same location
        socket.to(`location_${socket.data.currentLocationId}`).emit('player_left', playerLeftEvent);
      }
      
      socket.join(`location_${locationId}`);
      socket.data.currentLocationId = locationId;
      
      // Notify others character entered location
      const playerEnteredEvent = {
        characterId: character.characterId,
        characterName: character.characterName,
        locationId: locationId,
        timestamp: new Date().toISOString()
      };
      
      // ✅ ROOM-BASED: Only notify players in the same location
      socket.to(`location_${locationId}`).emit('player_entered', playerEnteredEvent);

      // Get location name from database
      let locationName = 'Unknown Location';
      try {
        const location = await Location.findById(locationId);
        if (location) {
          locationName = location.name;
        }
      } catch (error: any) {
        logger.warn('Impossibile recuperare il nome della location', { locationId, error: error?.message });
      }

      // Get list of characters already in this location
      const socketsInLocation = await io.in(`location_${locationId}`).fetchSockets();
      const presentCharacters = socketsInLocation
        .filter(s => s.data.character && s.id !== socket.id) // Exclude current socket
        .map(s => ({
          characterId: s.data.character.characterId,
          characterName: s.data.character.characterName,
          locationId: locationId
        }));

      socket.emit('location_joined', {
        locationId,
        locationName,
        timestamp: new Date().toISOString(),
        presentCharacters
      });
      
      logger.info(`${character.characterName} joined location ${locationId}`);
      
    } catch (error: any) {
      logger.error('Join location error:', error);
      socket.emit('error', { 
        message: 'Impossibile entrare nella location' 
      });
    }
  });

  /**
   * Leave a location room (back to parking at London)
   */
  socket.on('leave_location', async (locationId: string) => {
    try {
      if (!locationId || typeof locationId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(locationId)) {
        socket.emit('error', { code: 'INVALID_LOCATION_ID', message: 'ID location non valido' });
        return;
      }

      const character = socket.data.character;

      if (!character) {
        socket.emit('error', { code: 'CHARACTER_REQUIRED', message: 'Contesto personaggio richiesto' });
        return;
      }

      // Leave the location room
      socket.leave(`location_${locationId}`);
      socket.data.currentLocationId = null;

      // Notify others character left
      const playerLeftEvent = {
        characterId: character.characterId,
        characterName: character.characterName,
        locationId: locationId,
        timestamp: new Date().toISOString()
      };

      socket.to(`location_${locationId}`).emit('player_left', playerLeftEvent);

      // Confirm to client
      socket.emit('location_left', {
        locationId,
        timestamp: new Date().toISOString()
      });

      logger.info(`${character.characterName} left location ${locationId}`);

    } catch (error: any) {
      logger.error('Leave location error:', error);
      socket.emit('error', {
        message: 'Impossibile uscire dalla location'
      });
    }
  });

  /**
   * Prepare character for OffGame chat notifications
   * NOTE: No room joining needed - notifications are sent to character rooms directly
   */
  socket.on('join_offgame_chats', async () => {
    try {
      const character = socket.data.character;
      if (!character) {
        socket.emit('error', { code: 'CHARACTER_REQUIRED', message: 'Contesto personaggio richiesto per le chat OffGame' });
        return;
      }

      // Find all chats where this character is a participant
      const chats = await OffGameChat.find({
        participants: character.characterId,
        isActive: true
      });

      // Confirm to client (no need to join specific chat rooms anymore)
      socket.emit('offgame_chats_joined', {
        chatCount: chats.length,
        timestamp: new Date().toISOString()
      });

      logger.info(`${character.characterName} ready for OffGame chat notifications`, {
        chatCount: chats.length,
        characterRoom: `character_${character.characterId}`
      });

    } catch (error: any) {
      logger.error('Join OffGame chats error:', error);
      socket.emit('error', { 
        message: 'Impossibile entrare nelle chat OffGame' 
      });
    }
  });

  // NOTE: OffGame message broadcasting is handled directly by HTTP endpoints
  // via character-specific rooms, no need for separate WebSocket handlers
}

/**
 * Validate if character has permission for action type
 */
function validateActionPermission(actionType: ActionType, roles: string[]): boolean {
  switch (actionType) {
    case 'master':
      return roles.includes('master') || roles.includes('gestore');
    case 'moderation':
      return roles.includes('moderatore') || roles.includes('gestore');
    case 'standard':
    case 'whisper':
    case 'ooc':
    case 'dice_generic':
    case 'dice_action':
    case 'item_usage':
      return roles.includes('personaggio') || roles.includes('master') || roles.includes('moderatore') || roles.includes('gestore');
    default:
      return false;
  }
}

/**
 * Get visibility level for action type
 */
function getActionVisibility(actionType: ActionType): 'public' | 'whisper' | 'master_only' {
  switch (actionType) {
    case 'whisper':
      return 'whisper';
    case 'moderation':
      return 'master_only';
    default:
      return 'public';
  }
}

/**
 * Emit location action to appropriate recipients
 */
async function emitChat(io: SocketIOServer, action: Chat): Promise<void> {
  const locationRoom = `location_${action.locationId}`;
  
  switch (action.visibility) {
    case 'public':
      // Send to all players in location
      io.to(locationRoom).emit('location_action', action);
      break;
      
    case 'whisper':
      // Send to sender and target characters only
      if (action.targetCharacters) {
        // Send to sender
        io.to(`character_${action.characterId}`).emit('location_action', action);
        
        // Send to each target character
        for (const targetId of action.targetCharacters) {
          io.to(`character_${targetId}`).emit('location_action', action);
        }
      }
      break;
      
    case 'master_only':
      // Send only to masters/moderators in location
      // For now, send to all and let client filter based on roles
      io.to(locationRoom).emit('location_action', action);
      break;
  }
}

/**
 * Simple dice rolling function
 */
function rollDice(diceSpec: string): { dice: string; result: number; success?: boolean } {
  // Parse dice specification (e.g., "1d100", "2d6+3", "1d20")
  const match = diceSpec.match(/^(\d+)d(\d+)(?:[+\-](\d+))?$/i);
  
  if (!match) {
    return { dice: diceSpec, result: 0 };
  }
  
  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * diceSize) + 1;
  }
  
  const result = total + modifier;
  
  // For normal dice rolls, return only the result without success/failure judgment
  return { dice: diceSpec, result };
}