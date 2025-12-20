import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Setup location-related WebSocket handlers
 */
export function setupLocationHandlers(socket: Socket, io: SocketIOServer): void {
  
  /**
   * Get location status (occupants, etc.)
   */
  socket.on('get_location_status', async (locationId: string) => {
    try {
      const character = socket.data.character;
      
      if (!character || !character.isApproved) {
        socket.emit('error', { 
          message: 'Valid character required to get location status' 
        });
        return;
      }
      
      // Get all sockets in the location room
      const locationRoom = `location_${locationId}`;
      const socketsInRoom = await io.in(locationRoom).fetchSockets();
      
      // Build occupants list
      const occupants = socketsInRoom
        .filter(s => s.data.character)
        .map(s => ({
          characterId: s.data.character.characterId,
          characterName: s.data.character.characterName,
          connectedAt: new Date().toISOString() // TODO: Track actual connection time
        }));
      
      socket.emit('location_status', {
        locationId,
        occupants,
        occupantCount: occupants.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('Get location status error:', error);
      socket.emit('error', { 
        message: 'Failed to get location status' 
      });
    }
  });
  
  /**
   * Change character's current location
   */
  socket.on('change_location', async (newLocationId: string) => {
    try {
      const character = socket.data.character;
      
      if (!character || !character.isApproved) {
        socket.emit('error', { 
          message: 'Valid character required to change location' 
        });
        return;
      }
      
      const oldLocationId = socket.data.currentLocationId;
      
      // Leave old location if any
      if (oldLocationId) {
        socket.leave(`location_${oldLocationId}`);
        
        // Notify others character left
        socket.to(`location_${oldLocationId}`).emit('player_left', {
          characterId: character.characterId,
          characterName: character.characterName,
          timestamp: new Date().toISOString()
        });
      }
      
      // Join new location
      socket.join(`location_${newLocationId}`);
      socket.data.currentLocationId = newLocationId;
      
      // Notify others character entered
      socket.to(`location_${newLocationId}`).emit('player_entered', {
        characterId: character.characterId,
        characterName: character.characterName,
        timestamp: new Date().toISOString()
      });
      
      // Confirm to client
      socket.emit('location_changed', {
        oldLocationId,
        newLocationId,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`${character.characterName} moved from ${oldLocationId || 'nowhere'} to ${newLocationId}`);
      
    } catch (error: any) {
      logger.error('Change location error:', error);
      socket.emit('error', { 
        message: 'Failed to change location' 
      });
    }
  });
}