import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Setup general game-related WebSocket handlers
 */
export function setupGameHandlers(socket: Socket, io: SocketIOServer): void {
  
  /**
   * Ping/pong for connection health
   */
  socket.on('ping', () => {
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
        role: user.role
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