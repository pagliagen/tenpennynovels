import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { LocationAction, Location, OffGameChat, OffGameChatMessage, OffGameChatParticipant } from '../../../database/models';

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

export interface LocationAction {
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
  socket.on('location_action', async (data: ChatActionRequest) => {
    console.warn('🔌 WebSocket: location_action is deprecated. Use HTTP endpoints instead.');
    socket.emit('error', { 
      message: 'location_action is deprecated. Use HTTP endpoints for sending messages.' 
    });
  });
  
  /**
   * Join a location room
   */
  socket.on('join_location', async (locationId: string) => {
    try {
      console.log('🚪 WebSocket: join_location request for:', locationId);
      const character = socket.data.character;
      
      // WebSocket accepts any valid character context - authorization is handled by HTTP endpoints
      if (!character) {
        console.log('❌ WebSocket: No character context found');
        socket.emit('error', { message: 'Character context required' });
        return;
      }
      
      console.log('✅ WebSocket: Proceeding with join for:', character.characterName);
      
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
        
        console.log(`📤 WebSocket: Broadcasting player_left to room location_${socket.data.currentLocationId}:`, playerLeftEvent);
        socket.to(`location_${socket.data.currentLocationId}`).emit('player_left', playerLeftEvent);
        
        // Also broadcast global presence update for location lists synchronization
        console.log(`🌍 WebSocket: Broadcasting global presence update - character left location`);
        io.emit('global_presence_update', {
          type: 'character_left_location',
          characterId: character.characterId,
          characterName: character.characterName,
          locationId: socket.data.currentLocationId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Join new location
      console.log('✅ WebSocket: Joining location room:', `location_${locationId}`);
      socket.join(`location_${locationId}`);
      socket.data.currentLocationId = locationId;
      
      // Notify others character entered location
      const playerEnteredEvent = {
        characterId: character.characterId,
        characterName: character.characterName,
        locationId: locationId,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📤 WebSocket: Broadcasting player_entered to room location_${locationId}:`, playerEnteredEvent);
      socket.to(`location_${locationId}`).emit('player_entered', playerEnteredEvent);
      
      // Also broadcast global presence update for location lists synchronization
      console.log(`🌍 WebSocket: Broadcasting global presence update - character entered location`);
      io.emit('global_presence_update', {
        type: 'character_entered_location',
        characterId: character.characterId,
        characterName: character.characterName,
        locationId: locationId,
        timestamp: new Date().toISOString()
      });
      
      // Get location name from database
      let locationName = 'Unknown Location';
      try {
        const location = await Location.findById(locationId);
        if (location) {
          locationName = location.name;
        }
      } catch (error: any) {
        console.warn('Failed to fetch location name for', locationId, error);
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

      // Confirm to client with list of present characters
      console.log(`📤 WebSocket: Sending location_joined confirmation for ${locationName} with ${presentCharacters.length} present characters`);
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
        message: 'Failed to join location' 
      });
    }
  });

  /**
   * Prepare character for OffGame chat notifications
   * NOTE: No room joining needed - notifications are sent to character rooms directly
   */
  socket.on('join_offgame_chats', async () => {
    console.log('🔌 Backend: Received join_offgame_chats request');
    try {
      const character = socket.data.character;
      console.log('🔌 Backend: Character context:', character?.characterName);
      if (!character) {
        console.log('🔌 Backend: No character context, sending error');
        socket.emit('error', { message: 'Character context required for OffGame chat' });
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
        message: 'Failed to join OffGame chats' 
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
async function emitLocationAction(io: SocketIOServer, action: LocationAction): Promise<void> {
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