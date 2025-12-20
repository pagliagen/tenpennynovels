import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { setupLocationHandlers } from './locationHandlers';
import { setupChatHandlers } from './chatHandlers';
import { setupGameHandlers } from './gameHandlers';
import { RedisEventManager } from '../services/RedisEventManager';
// TODO: Import from shared package when workspace configuration is complete  
import { AuthTokenPayload } from '../../../authentication-backend/src/types/auth';

interface CharacterContextPayload {
  userId: string;
  characterId: string;
  characterName: string;
  isApproved: boolean;
  gameplayRoles?: string[];
}

/**
 * Setup WebSocket server and handlers
 */
export async function setupWebSocket(io: SocketIOServer): Promise<void> {
  console.log('🔌 Setting up WebSocket server...');
  
  // Initialize Redis Event Manager
  console.log('📡 Initializing Redis Event Manager...');
  const redisEventManager = new RedisEventManager(io);
  await redisEventManager.initialize();
  logger.info('✅ Redis Event Manager initialized and subscribed to channels');
  
  // Authentication middleware for WebSocket connections
  io.use(async (socket: Socket, next) => {
    console.log('🔌 WebSocket authentication middleware triggered');
    
    try {
      // Parse cookies from header
      const cookies = socket.handshake.headers.cookie;
      let authToken = null;
      let characterToken = null;
      
      if (cookies) {
        const cookieArray = cookies.split('; ');
        for (const cookie of cookieArray) {
          const [name, value] = cookie.split('=');
          if (name === 'auth_token') {
            authToken = value;
          } else if (name === 'character_context') {
            characterToken = value;
          }
        }
      }
      
      if (!authToken) {
        return next(new Error('Authentication token required'));
      }
      
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return next(new Error('Server configuration error'));
      }
      
      // Verify auth token
      const authPayload = jwt.verify(authToken, jwtSecret) as AuthTokenPayload;
      
      socket.data.user = {
        userId: authPayload.userId,
        username: authPayload.username,
        email: authPayload.email,
        canAccessAdminPanel: authPayload.canAccessAdminPanel,
        userRoles: authPayload.userRoles,
        characterRoles: authPayload.characterRoles,
        characterPermissions: authPayload.characterPermissions
      };
      
      // Verify character context token if provided
      if (characterToken) {
        try {
          const characterPayload = jwt.verify(characterToken, jwtSecret) as CharacterContextPayload;
          
          // Ensure character belongs to authenticated user
          if (characterPayload.userId !== authPayload.userId) {
            return next(new Error('Character does not belong to authenticated user'));
          }
          
          socket.data.character = {
            characterId: characterPayload.characterId,
            characterName: characterPayload.characterName,
            userId: characterPayload.userId,
            isApproved: characterPayload.isApproved,
            gameplayRoles: characterPayload.gameplayRoles || []
          };
        } catch (error: any) {
          logger.warn('Invalid character context token provided');
        }
      }
      
      logger.debug(`WebSocket authenticated: ${authPayload.username} (roles: ${JSON.stringify({userRoles: authPayload.userRoles, characterRoles: authPayload.characterRoles})})`);
      next();
      
    } catch (error: any) {
      logger.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    const character = socket.data.character;
    
    logger.info(`WebSocket connected: ${user.username} (${user.userId})`);
    if (character) {
      logger.info(`Character context: ${character.characterName} (${character.characterId})`);
    }
    
    // Join user-specific room
    socket.join(`user_${user.userId}`);
    
    // Join role-specific rooms based on new granular system
    if (user.userRoles?.includes('gestore')) {
      socket.join('admin');
      socket.join('staff');
    }
    
    if (user.characterRoles?.includes('amministratore') || user.characterRoles?.includes('master') || user.characterRoles?.includes('moderatore')) {
      socket.join('staff');
    }
    
    // Join character-specific room if character context exists (all statuses except DELETED can access game)
    if (character) {
      socket.join(`character_${character.characterId}`);
    }
    
    // Setup event handlers
    setupLocationHandlers(socket, io);
    setupChatHandlers(socket, io);
    setupGameHandlers(socket, io);
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket disconnected: ${user.username} (${reason})`);
      
      // Emit user offline status
      socket.broadcast.emit('user_status_change', {
        userId: user.userId,
        username: user.username,
        status: 'offline',
        timestamp: new Date().toISOString()
      });
      
      // If character was in a location, notify others they left
      if (character && socket.data.currentLocationId) {
        socket.to(`location_${socket.data.currentLocationId}`).emit('player_left', {
          characterId: character.characterId,
          characterName: character.characterName,
          timestamp: new Date().toISOString()
        });
        
        // Also broadcast global presence update for location lists synchronization
        console.log(`🌍 WebSocket: Broadcasting global presence update - character disconnected from location`);
        socket.broadcast.emit('global_presence_update', {
          type: 'character_left_location',
          characterId: character.characterId,
          characterName: character.characterName,
          locationId: socket.data.currentLocationId,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Emit user online status
    socket.broadcast.emit('user_status_change', {
      userId: user.userId,
      username: user.username,
      status: 'online',
      timestamp: new Date().toISOString()
    });
    
    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to TenpennyNovels Game Backend',
      user: {
        userId: user.userId,
        username: user.username,
        userRoles: user.userRoles,
        characterRoles: user.characterRoles,
        canAccessAdminPanel: user.canAccessAdminPanel
      },
      character: character ? {
        characterId: character.characterId,
        characterName: character.characterName,
        isApproved: character.isApproved
      } : null,
      timestamp: new Date().toISOString()
    });
  });
  
  logger.info('WebSocket server setup completed');
}