import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../logger';
import { Location } from '@core/location/models/Location';
import { OffGameChat } from '@features/offGameMessages/api';

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
