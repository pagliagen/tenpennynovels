import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';
import { setupChatHandlers } from './chatHandlers';
import { setupGameHandlers } from './gameHandlers';
import { RedisSubscriber } from '../events/RedisSubscriber';
import { RequestUser } from '@shared/types';
import { hasAdminPermission } from '@config/admin-permissions';
import { appConfig } from '@config/runtime';

interface CharacterContextPayload {
  userId: string;
  characterId: string;
  characterName: string;
  isApproved: boolean;
  gameplayRoles?: string[];
  isGestore?: boolean;
}

let redisSubscriberInstance: RedisSubscriber | null = null;

export function getRedisSubscriber(): RedisSubscriber | null {
  return redisSubscriberInstance;
}

/**
 * Setup WebSocket server and handlers
 */
export async function setupWebSocket(io: SocketIOServer): Promise<void> {
  logger.info('Inizializzazione server WebSocket...');
  const redisSubscriber = new RedisSubscriber(io);
  await redisSubscriber.initialize();
  redisSubscriberInstance = redisSubscriber;
  logger.info('✅ Redis Subscriber initialized and subscribed to all channels');
  
  // Authentication middleware for WebSocket connections
  io.use(async (socket: Socket, next) => {
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
        return next(new Error('Token di autenticazione richiesto'));
      }
      
      if (!appConfig.jwt.secret) {
        return next(new Error('JWT_SECRET non configurato'));
      }
      const jwtSecret = appConfig.jwt.secret;
      
      // Verify auth token (solo campi token; campi admin da character non presenti in WS)
      const authPayload = jwt.verify(authToken, jwtSecret) as RequestUser;
      socket.data.user = {
        userId: authPayload.userId,
        username: authPayload.username,
        email: authPayload.email ?? '',
        userRoles: authPayload.userRoles ?? ['user'],
        iat: authPayload.iat,
        exp: authPayload.exp
      } as RequestUser;
      
      // Verify character context token if provided
      if (characterToken) {
        try {
          const characterPayload = jwt.verify(characterToken, jwtSecret) as CharacterContextPayload;
          
          // Ensure character belongs to authenticated user
          if (characterPayload.userId !== authPayload.userId) {
            return next(new Error('Il personaggio non appartiene all\'utente autenticato'));
          }
          
          socket.data.character = {
            characterId: characterPayload.characterId,
            characterName: characterPayload.characterName,
            userId: characterPayload.userId,
            isApproved: characterPayload.isApproved,
            gameplayRoles: characterPayload.gameplayRoles || [],
            isGestore: characterPayload.isGestore || false,
          };
        } catch (error: any) {
          logger.warn('Invalid character context token provided');
        }
      }
      
      logger.debug(`WebSocket authenticated: ${authPayload.username} (userRoles: ${JSON.stringify(authPayload.userRoles)})`);
      next();
      
    } catch (error: any) {
      logger.error('WebSocket authentication error:', error);
      next(new Error('Autenticazione fallita'));
    }
  });
  
  // Connection handler
  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user;
    const character = socket.data.character;
    
    logger.info(`WebSocket connected: ${user.username} (${user.userId})`);
    if (character) {
      logger.info(`Character context: ${character.characterName} (${character.characterId})`);
    }
    
    // Join user-specific room
    socket.join(`user_${user.userId}`);

    // Join role-specific rooms based on character gameplayRoles or isGestore flag
    const roles = character?.gameplayRoles || [];
    const isStaff = character?.isGestore || roles.includes('amministratore') || roles.includes('master') || roles.includes('moderatore');
    if (isStaff) {
      socket.join('admin');
      socket.join('staff');
      socket.join(`staff_${user.userId}`);

      if (character?.isGestore || roles.includes('amministratore')) {
        socket.join('staff_leadership');
      }
    }

    // Fallback: management panel connects without character_context.
    // Query DB to check if user has an admin character that should join staff room.
    if (!character && !isStaff) {
      try {
        const { Character } = await import('@database/models');
        const adminChar = await Character.findOne({
          userId: user.userId,
          canAccessAdminPanel: true
        }).select('isGestore gameplayRoles adminPermissions').lean() as any;

        if (adminChar) {
          const adminRoles = adminChar.gameplayRoles || [];
          const isAdminStaff = adminChar.isGestore ||
            adminRoles.includes('master') || adminRoles.includes('moderatore');
          const hasApprovePerm = hasAdminPermission(
            adminRoles,
            adminChar.adminPermissions || [],
            adminChar.isGestore || false,
            'characters.approve'
          );

          if (isAdminStaff || hasApprovePerm) {
            socket.join('admin');
            socket.join('staff');
            socket.join(`staff_${user.userId}`);

            if (adminChar.isGestore || adminRoles.includes('amministratore')) {
              socket.join('staff_leadership');
            }

            logger.info(`[WebSocket] Admin fallback: ${user.username} joined staff room via DB lookup`);
          }
        }
      } catch (err) {
        logger.error('[WebSocket] Failed to check admin character for staff room:', err);
      }
    }
    
    // Join character-specific room if character context exists
    if (character) {
      socket.join(`character_${character.characterId}`);
    }
    
    // Setup event handlers
    setupChatHandlers(socket, io);
    setupGameHandlers(socket, io);
    
    // Handle disconnection
    socket.on('disconnect', async (reason) => {
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
        const locationId = socket.data.currentLocationId;

        // Emit WebSocket events (existing code)
        socket.to(`location_${locationId}`).emit('player_left', {
          characterId: character.characterId,
          characterName: character.characterName,
          timestamp: new Date().toISOString()
        });

        // ✅ Clean DB to prevent stale data (crash/close tab without explicit leave)
        // This ensures DB stays in sync with Socket.IO rooms
        try {
          // Import models (dynamic import for performance)
          const { Character, Location } = await import('@database/models');

          // Clear character's currentLocation
          await Character.findByIdAndUpdate(character.characterId, {
            currentLocation: null
          });

          // Remove from location's occupants array
          await Location.findByIdAndUpdate(locationId, {
            $pull: { occupants: { characterId: character.characterId } }
          });

          logger.info('[Disconnect] ✅ DB cleaned - removed character from location', {
            characterId: character.characterId,
            characterName: character.characterName,
            locationId
          });
        } catch (error: any) {
          logger.error('[Disconnect] ❌ Failed to clean DB:', error);
          // Non-blocking: Events already emitted, just log error
          // User will be removed from UI via player_left event
        }
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
      message: 'Connected to TenPennyNovels Game Backend',
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