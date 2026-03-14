import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../logger';
import { Character } from '../../../database/models/Character';
import { Location } from '../../../database/models/Location';

/**
 * Setup general game-related WebSocket handlers
 */
export function setupGameHandlers(socket: Socket, io: SocketIOServer): void {
  
  /**
   * Ping/pong for connection health + presence heartbeat
   */
  socket.on('ping', async () => {
    const character = socket.data.character;
    const currentLocationId = socket.data.currentLocationId;

    if (character?.characterId) {
      try {
        // Update Character.lastActive (PRIMARY HEARTBEAT)
        await Character.findByIdAndUpdate(
          character.characterId,
          {
            $set: {
              lastActive: new Date(),
              currentLocation: currentLocationId || null
            }
          },
          { timestamps: false }
        );

        // Update location.occupants[].lastSeen if in location
        if (currentLocationId) {
          await Location.findOneAndUpdate(
            {
              _id: currentLocationId,
              'occupants.characterId': character.characterId
            },
            {
              $set: {
                'occupants.$.lastSeen': new Date(),
                'occupants.$.isActive': true
              }
            }
          );
        }
      } catch (err) {
        logger.error('Ping heartbeat update failed:', err);
      }
    }

    socket.emit('pong', {
      timestamp: new Date().toISOString()
    });
  });
  
  /**
   * Get user's current status
   */
  socket.on('get_status', () => {
    const user = socket.data.user;
    const character = socket.data.character;
    
    socket.emit('status', {
      user: {
        userId: user.userId,
        username: user.username,
        userRoles: user.userRoles
      },
      character: character ? {
        characterId: character.characterId,
        characterName: character.characterName,
        isApproved: character.isApproved,
        gameplayRoles: character.gameplayRoles || []
      } : null,
      currentLocationId: socket.data.currentLocationId || null,
      connected: true,
      timestamp: new Date().toISOString()
    });
  });
  
  /**
   * Handle typing indicators
   */
  socket.on('typing_start', (locationId: string) => {
    if (!locationId || typeof locationId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(locationId)) {
      return;
    }

    const character = socket.data.character;
    
    if (!character || !character.isApproved) {
      return;
    }
    
    socket.to(`location_${locationId}`).emit('user_typing', {
      characterId: character.characterId,
      characterName: character.characterName,
      locationId,
      typing: true,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('typing_stop', (locationId: string) => {
    if (!locationId || typeof locationId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(locationId)) {
      return;
    }

    const character = socket.data.character;
    
    if (!character || !character.isApproved) {
      return;
    }
    
    socket.to(`location_${locationId}`).emit('user_typing', {
      characterId: character.characterId,
      characterName: character.characterName,
      locationId,
      typing: false,
      timestamp: new Date().toISOString()
    });
  });
}