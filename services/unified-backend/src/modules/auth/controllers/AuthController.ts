import { Request, Response } from 'express';
import { User, Character, Location } from '@database/models';
import { CryptoUtils } from '../utils/crypto';
import { AuthMiddleware } from '../middleware/auth';
import { RateLimitMiddleware } from '../middleware/rateLimit';
import { logger, logAuth, logSecurity } from '../logger';
import { CharacterSessionManager } from '../utils/characterSessionManager';
import { redis } from '@config/runtime/redis';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { ApiResponse } from '../types/auth';
import { DeviceInfo, LocationInfo } from '../types/auth';
import { successResponse, errorResponse, createResponse } from '@shared/utils/apiResponse';
import { getEffectivePermissions as calculateEffectivePermissions } from '@config/permissions';
import { appConfig } from '@config/runtime';
import {
  resolveEffectiveBan,
  type CharacterBanFields,
  type LegacyUserBanFields,
} from '@shared/utils/characterBan';

// Helper function to transform technical validation messages into user-friendly ones
function transformValidationMessage(field: string, originalMessage: string, validationKind: string): string {
  const fieldTranslations: Record<string, string> = {
    'name': 'Nome',
    'surname': 'Cognome', 
    'age': 'Età',
    'apparentAge': 'Età apparente',
    'description': 'Descrizione',
    'physicalDescription': 'Descrizione fisica',
    'publicDescription': 'Biografia pubblica',
    'privateDescription': 'Storia personale',
    'birthPlace': 'Luogo di nascita',
    'occupation': 'Occupazione',
    'motivations': 'Motivazioni',
    'fears': 'Paure'
  };

  const fieldName = fieldTranslations[field] || field;

  // Handle different types of validation errors
  if (validationKind === 'minlength') {
    const minLength = originalMessage.match(/minimum allowed length \((\d+)\)/)?.[1];
    if (field === 'description') {
      return `${fieldName}: deve essere di almeno ${minLength} caratteri`;
    }
    return `${fieldName}: deve essere di almeno ${minLength} caratteri`;
  }

  if (validationKind === 'maxlength') {
    const maxLength = originalMessage.match(/maximum allowed length \((\d+)\)/)?.[1];
    return `${fieldName}: non può superare i ${maxLength} caratteri`;
  }

  if (validationKind === 'min') {
    const minValue = originalMessage.match(/minimum allowed value \((\d+)\)/)?.[1];
    return `${fieldName}: deve essere almeno ${minValue}`;
  }

  if (validationKind === 'max') {
    const maxValue = originalMessage.match(/maximum allowed value \((\d+)\)/)?.[1];
    return `${fieldName}: non può superare ${maxValue}`;
  }

  if (validationKind === 'required') {
    return `${fieldName}: è obbligatorio`;
  }

  if (validationKind === 'enum') {
    return `${fieldName}: valore non valido`;
  }

  // Fallback to a generic message
  return `${fieldName}: valore non valido`;
}

export class AuthController {
  /**
   * POST /auth/login
   * Authenticate user and set cookies
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, rememberMe, deviceInfo: clientDeviceInfo } = req.body;

      // Find user by username or email
      const user = await User.findOne({
        $or: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() }
        ]
      });

      if (!user) {
        await RateLimitMiddleware.recordFailedLogin(username);
        
        res.status(400).json(errorResponse( 
          'Utente non trovato. Se vuoi registrarti clicca qui.',
          'USER_NOT_FOUND',
          {
            canRegister: true,
            registerUrl: '/register',
            attempts: {
              remaining: 3,
              lockedUntil: null,
              lockoutDuration: '10 minutes after 5 failed attempts'
            }
          },
          401));
        return;
        return;
      }

      // Ban di gioco/chat/forum sono sul singolo personaggio (e legacy sullo User): non si blocca il login qui.

      // Password verification will be done first, email verification after

      // Verify password
      const isPasswordValid = await CryptoUtils.comparePassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        await RateLimitMiddleware.recordFailedLogin(username);
        
        logSecurity('failed_login_attempt', {
          identifier: username,
          userId: user.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.get('User-Agent')
        });

        res.status(400).json(errorResponse( 
          'Password non corretta. Se l\'hai dimenticata clicca qui.',
          'INVALID_PASSWORD',
          {
            canResetPassword: true,
            resetPasswordUrl: '/auth/forgot-password',
            attempts: {
              remaining: 3,
              lockedUntil: null,
              lockoutDuration: '10 minutes after 5 failed attempts'
            }
          },
          401));
        return;
        return;
      }

      // Check if email is verified (only after password is correct)
      if (!user.isEmailVerified) {
        res.status(400).json(errorResponse( 
          'Verifica il tuo indirizzo email prima di effettuare il login',
          'EMAIL_NOT_VERIFIED',
          {
            canResendVerification: true,
            verificationUrl: '/auth/resend-verification'
          },
          400));
        return;
        return;
      }

      // Clear failed login attempts on successful login
      await RateLimitMiddleware.clearFailedLogins(username);

      // Parse device info
      const ua = new UAParser(req.get('User-Agent'));
      const geo = geoip.lookup(req.ip || '127.0.0.1');
      
      const uaDeviceType = ua.getDevice().type;
      const deviceType: 'desktop' | 'mobile' | 'tablet' = 
        uaDeviceType === 'mobile' ? 'mobile' :
        uaDeviceType === 'tablet' ? 'tablet' :
        'desktop';

      const deviceInfo: DeviceInfo = {
        deviceName: clientDeviceInfo?.deviceName || `${ua.getBrowser().name} on ${ua.getOS().name}`,
        browser: ua.getBrowser().name,
        os: ua.getOS().name,
        deviceType,
        userAgent: req.get('User-Agent')
      };

      const locationInfo: LocationInfo = {
        ipAddress: req.ip || '127.0.0.1',
        country: geo?.country,
        city: geo?.city,
        region: geo?.region,
        timezone: geo?.timezone
      };

      // Update user login info
      user.lastLoginAt = new Date();
      user.loginCount += 1;
      await user.save();

      // Get user's characters
      let characters = await Character.find({
        userId: user.id,
        playerStatus: { $in: ['draft', 'pending', 'approved'] }
      }).select('id name surname playerStatus occupation currentLocation gameplayRoles characterType isBot lastActive submittedAt canAccessAdminPanel isGestore characterPermissions adminPermissions');
      
      logger.info(`User ${user.username} login: found ${characters.length} existing characters`);

      // Auto-create character if user has none
      if (characters.length === 0) {
        try {
          // Find unique character name (username, username2, username3, etc.)
          let characterName = user.username;
          let nameExists = await Character.findOne({ name: characterName });
          let counter = 2;
          
          while (nameExists) {
            characterName = `${user.username}${counter}`;
            nameExists = await Character.findOne({ name: characterName });
            counter++;
          }

          const newCharacter = new Character({
            userId: user.id,
            name: characterName,
            playerStatus: 'draft',
            gameplayRoles: ['player'],
            skills: {},
            isActive: false,
            submittedAt: new Date()
          });

          await newCharacter.save();
          characters = [newCharacter];
          
          logger.info(`Auto-created character for user ${user.username}: ${newCharacter.id} with name "${characterName}"`);
        } catch (characterError) {
          logger.error(`Failed to auto-create character for user ${user.username}:`, characterError);
          // Continue with empty characters array
        }
      }

      // Generate auth token
      const tokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        userRoles: user.userRoles || ['user']
      };

      const authToken = CryptoUtils.generateAuthToken(tokenPayload, rememberMe ? '7d' : '24h');

      // Set auth cookie
      AuthMiddleware.setAuthCookie(res, authToken, rememberMe);

      // Log successful login
      logAuth('user_login', user.id, {
        username: user.username,
        ipAddress: req.ip || '127.0.0.1',
        deviceInfo,
        locationInfo,
        rememberMe
      });

      // Publish Redis event
      await redis.publish('auth:user_login', JSON.stringify({
        userId: user.id,
        username: user.username,
        ipAddress: req.ip || '127.0.0.1',
        deviceInfo,
        locationInfo,
        loginAt: new Date().toISOString()
      }));

      // Publish admin login event if applicable
      await redis.publish('auth:admin_login', JSON.stringify({
        userId: user.id,
        username: user.username,
        userRoles: user.userRoles || ['user'],
        ipAddress: req.ip || '127.0.0.1',
        loginAt: new Date().toISOString()
      }));

      // Handle character context based on character count
      logger.info(`User ${user.username} login: ${characters.length} characters found`);

      // NEW FLOW: Auto-select with SessionStore (multi-tab support)
      let sessionId: string | undefined;

      // ✅ CRITICAL: Invalidate ALL previous sessions BEFORE creating new one
      // Defense: Prevent session accumulation + revoke leaked sessions
      try {
        const { SessionStore } = await import('../services/SessionStore');

        const deletedCount = await SessionStore.deleteUserSessions(user.id);

        if (deletedCount > 0) {
          logger.info(`Login: Invalidated ${deletedCount} previous sessions`, {
            userId: user.id,
            username: user.username
          });
        }
      } catch (error) {
        // ✅ CRITICAL DECISION: Non-blocking (continue login even if cleanup fails)
        // Rationale: Availability > Consistency (user should login even if Redis down)
        logger.error('Failed to invalidate previous sessions', {
          error,
          userId: user.id,
          username: user.username
        });
      }

      if (characters.length === 1) {
        const userCharacter = characters[0];
        logger.info(`User ${user.username}: Auto-selecting character ${userCharacter.name} (${userCharacter.id})`);

        // Import SessionStore dynamically
        const { SessionStore } = await import('../services/SessionStore');

        // Create session in Redis (multi-tab support)
        sessionId = await SessionStore.createSession(
          user.id,
          userCharacter.id,
          {
            ...deviceInfo,
            ipAddress: req.ip || '127.0.0.1'
          }
        );

        logger.info(`User ${user.username}: Character session created (sessionId: ${sessionId})`);
      } else {
        logger.info(`User ${user.username}: No character auto-select - ${characters.length} characters (must select manually)`);
      }

      res.status(201).json(createResponse(
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            canAccessAdminPanel: user.canAccessAdminPanel,
            // New granular permission system
            userRoles: user.userRoles || ['user'],
            characterPermissions: user.characterPermissions || [],
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt,
            multipleCharactersAllowed: user.multipleCharactersAllowed,
            // Always include characters list - frontend needs it for logic
            characters: characters.map(char => ({
              id: char.id,
              name: char.name,
              playerStatus: char.playerStatus,
              occupation: char.occupation,
              currentLocation: char.currentLocation,
              gameplayRoles: char.gameplayRoles,
              characterType: char.characterType,
              lastActive: char.lastActive,
              submittedAt: char.submittedAt
            }))
          },
          session: {
            expiresAt: new Date(Date.now() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
            refreshable: true,
            deviceRegistered: true
          },
          // NEW: Include sessionId if character auto-selected
          ...(sessionId && { sessionId })
        },
        'Login successful'));

    } catch (error: any) {
      logger.error('Login error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        userAgent: req.headers?.['user-agent']
      });
      
      res.status(400).json(errorResponse( 
        'Login fallito',
        'LOGIN_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * POST /auth/select-character
   * Select active character and set character context cookie
   */
  static async selectCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.body;
      const userId = req.user!.userId;

      // Find character and verify ownership
      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

      if (!character) {
        res.status(400).json(errorResponse( 
          'Personaggio non trovato o non appartiene a questo utente',
          'CHARACTER_NOT_FOUND',
          undefined,
          404));
        return;
        return;
      }

      if (character.status === 'DELETED') {
        res.status(400).json(errorResponse( 
          'Il personaggio è stato eliminato e non può essere utilizzato',
          'CHARACTER_DELETED',
          {
            character: {
              id: character.id,
              name: character.name,
              playerStatus: character.playerStatus
            }
          },
          404));
        return;
        return;
      }

      // Deactivate other characters for this user
      await Character.updateMany(
        { userId: userId, _id: { $ne: characterId } },
        { isActive: false }
      );

      // Activate selected character and reset location (parked at London)
      character.isActive = true;
      character.lastActive = new Date();
      
      // Remove character from all locations before parking at London
      if (character.currentLocation) {
        await Location.updateMany(
          { 'occupants.characterId': character.id },
          { $pull: { occupants: { characterId: character.id } } }
        );
      }
      
      character.currentLocation = null; // Park character at London (root location)
      await character.save();

      // Build full character name (name + surname if present)
      const fullCharacterName = character.surname
        ? `${character.name} ${character.surname}`
        : character.name;

      // Publish character activation event to Redis
      await redis.publish('user:events', JSON.stringify({
        type: 'user_character_selected',
        userId: userId,
        characterId: character.id,
        characterName: fullCharacterName,
        timestamp: new Date().toISOString()
      }));

      // Parse device info for session creation
      const ua = new UAParser(req.get('User-Agent'));
      const deviceType = ua.getDevice().type === 'mobile' ? 'mobile' :
                        ua.getDevice().type === 'tablet' ? 'tablet' : 'desktop';

      const deviceInfo = {
        userAgent: req.get('User-Agent') || 'Unknown',
        browser: ua.getBrowser().name,
        os: ua.getOS().name,
        deviceType: deviceType as 'desktop' | 'mobile' | 'tablet',
        ipAddress: req.ip || '127.0.0.1'
      };

      // NEW FLOW: Create session in Redis (multi-tab support)
      // Import SessionStore dynamically to avoid circular dependency
      const { SessionStore } = await import('../services/SessionStore');

      const sessionId = await SessionStore.createSession(
        userId,
        character.id,
        deviceInfo
      );

      // OPTIONAL: Save CharacterSession in MongoDB for audit log
      // Note: This no longer invalidates previous sessions (multi-tab support)
      // We still save to MongoDB for audit trail but use Redis for active sessions
      try {
        await CharacterSessionManager.createCharacterSession(
          character.id,
          userId,
          sessionId, // Use sessionId as token (audit trail)
          deviceInfo as DeviceInfo,
          req.ip || '127.0.0.1',
          '24h'
        );
      } catch (mongoError) {
        // Non-blocking: MongoDB audit log failed but Redis session exists
        logger.warn('Failed to create MongoDB audit session', { error: mongoError, sessionId });
      }

      logAuth('character_selected', userId, {
        characterId: character.id,
        characterName: character.name,
        sessionId: sessionId,
        ipAddress: req.ip
      });

      const legacyUser = await User.findById(userId)
        .select('isBanned banScope banReason bannedAt bannedUntil')
        .lean();
      const ban = resolveEffectiveBan(
        character.toObject() as unknown as CharacterBanFields,
        legacyUser as unknown as LegacyUserBanFields
      );

      // CRITICAL: Return sessionId in JSON (frontend saves to sessionStorage)
      // NO cookie character_context (multi-tab support)
      res.status(201).json(createResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            playerStatus: character.playerStatus,
            occupation: character.occupation,
            currentLocation: character.currentLocation,
            gameplayRoles: character.gameplayRoles,
            lastActive: character.lastActive
          },
          ban,
          gameAccess: {
            canAccessGame: !ban.blocksLandAccess,
            canAccessLocations: !ban.blocksLandAccess,
            canSendMessages: !ban.blocksChatWrite,
            canUseItems: !ban.blocksLandAccess,
            canWriteForum: !ban.blocksForumWrite,
          },
          sessionId: sessionId  // NEW: Frontend saves to sessionStorage
        },
        'Character selected successfully'));

    } catch (error: any) {
      logger.error('Character selection error:', error);
      
      res.status(400).json(errorResponse( 
        'Selezione personaggio fallita',
        'CHARACTER_SELECTION_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * POST /auth/create-character
   * Create new character in DRAFT status
   */
  static async createCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { name, occupation, currentOccupation, age, description, background } = req.body;
      const userId = req.user!.userId;

      // Basic validation
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json(errorResponse( 
          'Il nome del personaggio è richiesto e deve essere di almeno 2 caratteri',
          'VALIDATION_ERROR',
          undefined,
          400));
        return;
        return;
      }

      // Check if character name already exists for this user (exclude deleted)
      const existingCharacter = await Character.findOne({
        userId: userId,
        name: name.trim(),
      });

      if (existingCharacter) {
        res.status(400).json(errorResponse( 
          'Esiste già un personaggio con questo nome',
          'CHARACTER_NAME_EXISTS',
          undefined,
          400));
        return;
        return;
      }

      // Create new character in DRAFT status
      const character = new Character({
        userId,
        name: name.trim(),
        occupation: occupation?.trim() || undefined,
        currentOccupation: currentOccupation?.trim() || undefined,
        age: age || undefined,
        description: description?.trim() || undefined,
        background: background?.trim() || undefined,
        playerStatus: 'draft',
        gameplayRoles: ['player'],
        isActive: false,
        createdAt: new Date()
      });

      await character.save();

      logAuth('character_created', userId, {
        characterId: character.id,
        characterName: character.name,
        ipAddress: req.ip
      });

      res.status(201).json(createResponse( 
        {
          character: {
            id: character.id,
            name: character.name,
            playerStatus: character.playerStatus,
            occupation: character.occupation,
            currentOccupation: character.currentOccupation,
            age: character.age,
            background: character.background,
            createdAt: character.createdAt
          }
        },
        'Character created successfully'));

    } catch (error: any) {
      logger.error('Character creation error:', error);
      
      // Handle Mongoose validation errors specifically
      if (error instanceof Error && error.name === 'ValidationError') {
        const validationError = error as Error & { errors: Record<string, { message: string; kind: string }> };
        const details: Record<string, string> = {};
        
        for (const field in validationError.errors) {
          const fieldError = validationError.errors[field];
          
          details[field] = transformValidationMessage(field, fieldError.message, fieldError.kind);
        }
        
        res.status(400).json(errorResponse( 
          'Errori nei dati del personaggio',
          'CHARACTER_VALIDATION_ERROR',
          details,
          400));
        return;
        return;
      }
      
      // Handle duplicate name errors
      if (error instanceof Error && 'code' in error && (error as Error & { code: number }).code === 11000) {
        res.status(400).json(errorResponse( 
          'Esiste già un personaggio con questo nome',
          'CHARACTER_NAME_EXISTS',
          undefined,
          400));
        return;
        return;
      }
      
      // Generic server error
      res.status(400).json(errorResponse( 
        'Creazione personaggio fallita',
        'CHARACTER_CREATION_ERROR',
        !appConfig.isProduction ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500));
        return;
    }
  }

  /**
   * POST /auth/refresh
   * Refresh authentication token
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Generate new token with same payload but fresh expiry
      const tokenPayload = {
        userId: user.userId,
        username: user.username,
        email: user.email,
        userRoles: user.userRoles || ['user']
      };

      const newAuthToken = CryptoUtils.generateAuthToken(tokenPayload, '24h');
      
      // Set new auth cookie
      AuthMiddleware.setAuthCookie(res, newAuthToken);

      res.status(200).json(successResponse( 
        {
          session: {
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            refreshedAt: new Date().toISOString()
          }
        },
        'Session refreshed successfully'));

    } catch (error: any) {
      logger.error('Token refresh error:', error);
      
      res.status(400).json(errorResponse( 
        'Aggiornamento token fallito',
        'REFRESH_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * GET /auth/session
   * Verify current session validity
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    try {
      // If no user token, return not authenticated
      if (!req.user) {
        res.status(401).json(errorResponse(
          'Non autenticato',
          'NOT_AUTHENTICATED',
          undefined,
          401));
        return;
      }

      const user = req.user;
      const character = req.character;

      // Import game permissions utility
      const { getCharacterGamePermissions } = await import('@config/permissions');

      // If character exists in JWT token, fetch full character data from database
      let characterData = null;
      let gamePermissions: string[] = [];
      let fullCharacter: any = null;

      let banPayload: ReturnType<typeof resolveEffectiveBan> | null = null;

      if (character) {
        fullCharacter = await Character.findById(character.characterId)
          .select(
            '_id name surname avatar playerStatus canAccessAdminPanel isGestore gameplayRoles characterPermissions adminPermissions isBanned banScope banReason bannedAt bannedUntil userId'
          )
          .lean();

        if (fullCharacter) {
          characterData = {
            _id: fullCharacter._id.toString(),
            name: fullCharacter.name,
            surname: fullCharacter.surname,
            avatar: fullCharacter.avatar || null,
            playerStatus: fullCharacter.playerStatus,
            isGestore: fullCharacter.isGestore || false
          };

          gamePermissions = getCharacterGamePermissions(
            fullCharacter.playerStatus,
            fullCharacter.isGestore || false,
            fullCharacter.gameplayRoles || [],
            fullCharacter.characterPermissions || []
          );

          const legacyUser = await User.findById(user.userId)
            .select('isBanned banScope banReason bannedAt bannedUntil')
            .lean();
          banPayload = resolveEffectiveBan(
            fullCharacter as unknown as CharacterBanFields,
            legacyUser as unknown as LegacyUserBanFields
          );
        }
      }

      res.status(200).json(successResponse(
        {
          valid: true,
          user: {
            id: user.userId,
            username: user.username,
            canAccessAdminPanel: fullCharacter
              ? (fullCharacter.canAccessAdminPanel || fullCharacter.isGestore || false)
              : false
          },
          character: characterData,
          gamePermissions: gamePermissions, // NEW: Game permissions for frontend
          ban: banPayload,
          session: {
            expiresAt: new Date(user.exp * 1000).toISOString(),
            timeRemaining: `${Math.floor((user.exp * 1000 - Date.now()) / (1000 * 60 * 60))} hours ${Math.floor(((user.exp * 1000 - Date.now()) % (1000 * 60 * 60)) / (1000 * 60))} minutes`
          }
        },
        undefined
      ));

    } catch (error: any) {
      logger.error('Session check error:', error);

      res.status(400).json(errorResponse(
        'Controllo sessione fallito',
        'SESSION_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * POST /auth/logout
   * Terminate user session and clear cookies
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { logoutAllDevices = false, reason } = req.body || {};
      const user = req.user;

      if (user) {
        logAuth('user_logout', user.userId, {
          username: user.username,
          ipAddress: req.ip || '127.0.0.1',
          reason: reason || 'user_initiated',
          logoutAllDevices: logoutAllDevices || false
        });

        // Extract character context from cookie before clearing
        let characterId: string | null = null;
        let characterName: string | null = null;

        try {
          const characterToken = req.cookies?.character_context;
          if (characterToken) {
            const decoded = CryptoUtils.verifyCharacterContextToken(characterToken);
            characterId = decoded.characterId;
            characterName = decoded.characterName;
          }
        } catch (error) {
          // Invalid/expired token - ignore
        }

        // Publish Redis event with character info if available
        await redis.publish('user:events', JSON.stringify({
          type: 'user_logout',
          userId: user.userId,
          username: user.username,
          characterId: characterId,
          characterName: characterName,
          timestamp: new Date().toISOString(),
          reason: reason || 'user_initiated'
        }));

        // ✅ NEW: Invalidate Redis SessionStore sessions (multi-tab support)
        try {
          const { SessionStore } = await import('../services/SessionStore');

          const deletedCount = await SessionStore.deleteUserSessions(user.userId);

          logger.info('Logout: Invalidated Redis sessions', {
            userId: user.userId,
            username: user.username,
            deletedCount
          });
        } catch (error) {
          // Non-blocking: continue logout even if Redis cleanup fails
          logger.error('Failed to invalidate Redis sessions on logout', {
            error,
            userId: user.userId
          });
        }

        // ❌ LEGACY: Invalidate MongoDB CharacterSession (audit log only)
        // NOTE: This is separate from Redis SessionStore (two systems)
        const activeSessions = await CharacterSessionManager.getUserActiveSessions(user.userId);
        for (const session of activeSessions) {
          await CharacterSessionManager.invalidateSession(
            session.sessionId, 
            'user_logout', 
            req.ip || '127.0.0.1'
          );
        }
      }

      // Clear authentication cookies
      AuthMiddleware.clearAuthCookies(res);

      res.status(200).json(successResponse( 
        {
          session: {
            loggedOutAt: new Date().toISOString(),
            allDevicesLoggedOut: logoutAllDevices || false
          },
        },
        'Logged out successfully'));

    } catch (error: any) {
      logger.error('Logout error:', error);
      
      // Clear cookies anyway
      AuthMiddleware.clearAuthCookies(res);
      
      res.status(400).json(errorResponse( 
        'Logout fallito',
        'LOGOUT_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * POST /auth/logout-all
   * Terminate all user sessions
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Invalidate Redis session
      await redis.del(`session:${user.userId}`);

      // Publish force logout event for WebSocket disconnect
      await redis.publish('user:events', JSON.stringify({
        type: 'force_logout',
        userId: user.userId,
        reason: 'logout_all',
        timestamp: new Date().toISOString()
      }));

      logAuth('user_logout_all', user.userId, {
        username: user.username,
        ipAddress: req.ip
      });

      // Clear authentication cookies
      AuthMiddleware.clearAuthCookies(res);

      res.status(200).json(successResponse(
        {
          sessionsTerminated: 1,
          terminatedAt: new Date().toISOString()
        },
        'All sessions terminated successfully'));

    } catch (error: any) {
      logger.error('Logout all error:', error);
      
      res.status(400).json(errorResponse(
        'Logout completo fallito',
        'LOGOUT_ALL_ERROR',
        undefined,
        500));
        return;
    }
  }

  /**
   * Get effective permissions for current character
   *
   * Calculates final permission list based on:
   * - Character.isGestore (bypass flag)
   * - Character.adminRoles → ROLE_PERMISSIONS mapping
   * - Character.characterPermissions (custom overrides)
   *
   * Used by frontend permissionsStore to filter UI elements.
   *
   * @route GET /auth/effective-permissions
   * @requires authMiddleware
   * @requires X-Session-Id header OR character_context cookie (legacy)
   */
  static async getEffectivePermissions(req: Request, res: Response): Promise<void> {
    try {
      let characterId: string | undefined;

      // ✅ NEW FLOW: Try X-Session-Id header first (multi-tab support)
      const sessionId = req.headers['x-session-id'] as string | undefined;

      if (sessionId) {
        try {
          const { SessionStore } = await import('../services/SessionStore');
          const session = await SessionStore.getSession(sessionId);

          if (session && session.userId === req.user?.userId) {
            characterId = session.characterId;
            logger.info('[EffectivePermissions] Session authenticated via X-Session-Id', {
              sessionId,
              characterId
            });
          } else if (session) {
            logger.warn('[EffectivePermissions] Session ownership mismatch', {
              sessionId,
              sessionUserId: session.userId,
              tokenUserId: req.user?.userId
            });
          }
        } catch (error: unknown) {
          logger.error('[EffectivePermissions] Session validation error', { error, sessionId });
        }
      }

      // ✅ FALLBACK: Use character_context cookie (legacy)
      if (!characterId) {
        const characterContext = req.cookies?.character_context;
        if (!characterContext) {
          res.status(400).json(errorResponse('Nessun personaggio selezionato', 'NO_CHARACTER_CONTEXT', undefined, 401));
          return;
        }

        // Verify JWT token
        const decoded = CryptoUtils.verifyCharacterContextToken(characterContext);
        if (!decoded || !decoded.characterId) {
          res.status(400).json(errorResponse('Contesto personaggio non valido', 'INVALID_CHARACTER_CONTEXT', undefined, 401));
          return;
        }

        characterId = decoded.characterId;
        logger.warn('[EffectivePermissions] DEPRECATED: Using character_context cookie', {
          userId: req.user?.userId,
          characterId
        });
      }

      // Fetch character from database
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(400).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404));
        return;
      }

      // Calculate effective permissions (gameplayRoles → admin mapping + adminPermissions)
      const gameplayRoles = character.gameplayRoles || [];
      const adminPermissions = character.adminPermissions || [];
      const isGestore = character.isGestore || false;

      const effectivePermissions = calculateEffectivePermissions(
        gameplayRoles,
        adminPermissions,
        isGestore
      );

      // Return permissions
      res.status(200).json(successResponse({
        isGestore,
        permissions: effectivePermissions
      }, 'Permissions calculated successfully'));
        return;

    } catch (error: any) {
      logger.error('Get effective permissions error:', error);
      res.status(400).json(errorResponse('Impossibile recuperare i permessi', 'GET_PERMISSIONS_ERROR', undefined, 500));
        return;
    }
  }
}