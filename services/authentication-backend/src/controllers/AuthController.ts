import { Request, Response } from 'express';
import { User, Character, Location } from '../../../database/models';
import { CryptoUtils } from '../utils/crypto';
import { AuthMiddleware } from '../middleware/auth';
import { RateLimitMiddleware } from '../middleware/rateLimit'; 
import { logger, logAuth, logSecurity } from '../utils/logger';
import { CharacterSessionManager } from '../utils/characterSessionManager';
import { redis } from '../config/redis';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { ApiResponse } from '../types/auth';
import { DeviceInfo, LocationInfo } from '../types/auth';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';

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
        
        res.status(401).json(errorResponse(
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
          401,
          getRequestId(req)
        ));
        return;
      }

      // Check if account is banned
      if (user.isBanned) {
        res.status(403).json(errorResponse(
          'L\'account è stato sospeso',
          'ACCOUNT_BANNED',
          {
            bannedUntil: user.bannedUntil?.toISOString() || null,
            reason: user.banReason || 'Community guidelines violation',
            canAppeal: true,
            appealUrl: '/support/appeal'
          },
          403,
          getRequestId(req)
        ));
        return;
      }

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

        res.status(401).json(errorResponse(
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
          401,
          getRequestId(req)
        ));
        return;
      }

      // Check if email is verified (only after password is correct)
      if (!user.isEmailVerified && process.env.NODE_ENV === 'production') {
        res.status(400).json(errorResponse(
          'Verifica il tuo indirizzo email prima di effettuare il login',
          'EMAIL_NOT_VERIFIED',
          {
            canResendVerification: true,
            verificationUrl: '/auth/resend-verification'
          },
          400,
          getRequestId(req)
        ));
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
        status: { $in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] }
      }).select('id name status occupation currentLocation gameplayRoles lastActive submittedAt');
      
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
            status: 'DRAFT',
            gameplayRoles: ['personaggio'],
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
        canAccessAdminPanel: user.canAccessAdminPanel,
        // New granular permission system
        userRoles: user.userRoles || ['user'],
        characterRoles: user.characterRoles || ['personaggio'],
        characterPermissions: user.characterPermissions || []
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
      await redis.publish('auth:user_login', {
        userId: user.id,
        username: user.username,
        ipAddress: req.ip || '127.0.0.1',
        deviceInfo,
        locationInfo,
        loginAt: new Date().toISOString()
      });

      // Publish admin login event if applicable
      if (user.canAccessAdminPanel) {
        await redis.publish('auth:admin_login', {
          userId: user.id,
          username: user.username,
          userRoles: user.userRoles || ['user'],
          characterRoles: user.characterRoles || [],
          ipAddress: req.ip || '127.0.0.1',
          loginAt: new Date().toISOString()
        });
      }

      // Handle character context based on user settings
      logger.info(`User ${user.username} character context logic: canAccessAdminPanel=${user.canAccessAdminPanel}, multipleCharactersAllowed=${user.multipleCharactersAllowed}, characters.length=${characters.length}`);
      
      // Set character context for all users with exactly one character (including admins)
      if (!user.multipleCharactersAllowed && characters.length > 0) {
        // Single character user - auto-select their character
        const userCharacter = characters[0];
        logger.info(`User ${user.username}: Auto-selecting character ${userCharacter.name} (${userCharacter.id})`);
        
        // Auto-set character context cookie regardless of status
        const characterToken = CryptoUtils.generateCharacterContextToken({
          characterId: userCharacter.id,
          characterName: userCharacter.name,
          userId: user.id,
          gameplayRoles: userCharacter.gameplayRoles || ['personaggio']
        });

        // Create character session (invalidates any existing sessions for this character)
        await CharacterSessionManager.createCharacterSession(
          userCharacter.id,
          user.id,
          characterToken,
          deviceInfo,
          req.ip || '127.0.0.1',
          rememberMe ? '7d' : '24h'
        );

        // Set character context cookie  
        AuthMiddleware.setCharacterCookie(res, characterToken);
        logger.info(`User ${user.username}: Character context cookie set for ${userCharacter.name}`);
        
        // Mark character as active
        await Character.updateMany(
          { userId: user.id },
          { isActive: false }
        );
        await Character.findByIdAndUpdate(userCharacter.id, { 
          isActive: true,
          lastActive: new Date()
        });
      } else {
        logger.info(`User ${user.username}: No character context set - either admin or multipleCharactersAllowed=true or no characters`);
      }

      res.json(createResponse(
        {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            canAccessAdminPanel: user.canAccessAdminPanel,
            // New granular permission system
            userRoles: user.userRoles || ['user'],
            characterRoles: user.characterRoles || ['personaggio'],
            characterPermissions: user.characterPermissions || [],
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt,
            multipleCharactersAllowed: user.multipleCharactersAllowed,
            // Always include characters list - frontend needs it for logic
            characters: characters.map(char => ({
              id: char.id,
              name: char.name,
              status: char.status,
              occupation: char.occupation,
              currentLocation: char.currentLocation,
              gameplayRoles: char.gameplayRoles,
              lastActive: char.lastActive,
              submittedAt: char.submittedAt
            }))
          },
          session: {
            expiresAt: new Date(Date.now() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
            refreshable: true,
            deviceRegistered: true
          }
        },
        'Login successful',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Login error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        userAgent: req.headers?.['user-agent']
      });
      
      res.status(500).json(errorResponse(
        'Login fallito',
        'LOGIN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non appartiene a questo utente',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character can be selected (block only DELETED characters)
      if (character.status === 'DELETED') {
        res.status(404).json(errorResponse(
          'Il personaggio è stato eliminato e non può essere utilizzato',
          'CHARACTER_DELETED',
          {
            character: {
              id: character.id,
              name: character.name,
              status: character.status
            }
          },
          404,
          getRequestId(req)
        ));
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

      // Generate character context token
      const characterToken = CryptoUtils.generateCharacterContextToken({
        characterId: character.id,
        characterName: character.name,
        userId: userId,
        gameplayRoles: character.gameplayRoles || ['personaggio']
      });

      // Parse device info for session creation
      const ua = new UAParser(req.get('User-Agent'));
      const deviceType = ua.getDevice().type === 'mobile' ? 'mobile' :
                        ua.getDevice().type === 'tablet' ? 'tablet' : 'desktop';
      
      const deviceInfo: DeviceInfo = {
        userAgent: req.get('User-Agent'),
        browser: ua.getBrowser().name,
        os: ua.getOS().name,
        deviceType
      };

      // Create character session (invalidates any existing sessions for this character)
      await CharacterSessionManager.createCharacterSession(
        character.id,
        userId,
        characterToken,
        deviceInfo,
        req.ip || '127.0.0.1',
        '24h'
      );

      // Set character context cookie
      AuthMiddleware.setCharacterCookie(res, characterToken);

      logAuth('character_selected', userId, {
        characterId: character.id,
        characterName: character.name,
        ipAddress: req.ip
      });

      res.json(createResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            status: character.status,
            occupation: character.occupation,
            currentLocation: character.currentLocation,
            gameplayRoles: character.gameplayRoles,
            lastActive: character.lastActive
          },
          gameAccess: {
            canAccessGame: true,
            canAccessLocations: true,
            canSendMessages: true,
            canUseItems: true
          },
        },
        'Character selected successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Character selection error:', error);
      
      res.status(500).json(errorResponse(
        'Selezione personaggio fallita',
        'CHARACTER_SELECTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if character name already exists for this user (exclude deleted)
      const existingCharacter = await Character.findOne({
        userId: userId,
        name: name.trim(),
        status: { $ne: 'DELETED' }
      });

      if (existingCharacter) {
        res.status(400).json(errorResponse(
          'Esiste già un personaggio con questo nome',
          'CHARACTER_NAME_EXISTS',
          undefined,
          400,
          getRequestId(req)
        ));
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
        status: 'DRAFT',
        gameplayRoles: ['personaggio'],
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
            status: character.status,
            occupation: character.occupation,
            currentOccupation: character.currentOccupation,
            age: character.age,
            description: character.description,
            background: character.background,
            createdAt: character.createdAt
          }
        },
        'Character created successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Character creation error:', error);
      
      // Handle Mongoose validation errors specifically
      if (error instanceof Error && error.name === 'ValidationError') {
        const validationError = error as any;
        const details: Record<string, string> = {};
        
        // Extract field-specific validation errors and make them user-friendly
        for (const field in validationError.errors) {
          const fieldError = validationError.errors[field];
          
          // Transform technical validation messages into user-friendly ones
          details[field] = transformValidationMessage(field, fieldError.message, fieldError.kind);
        }
        
        res.status(400).json(errorResponse(
          'Errori nei dati del personaggio',
          'CHARACTER_VALIDATION_ERROR',
          details,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Handle duplicate name errors
      if (error instanceof Error && (error as any).code === 11000) {
        res.status(400).json(errorResponse(
          'Esiste già un personaggio con questo nome',
          'CHARACTER_NAME_EXISTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Generic server error
      res.status(500).json(errorResponse(
        'Creazione personaggio fallita',
        'CHARACTER_CREATION_ERROR',
        process.env.NODE_ENV === 'development' ? { message: error instanceof Error ? error.message : 'Unknown error' } : undefined,
        500,
        getRequestId(req)
      ));
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
        canAccessAdminPanel: user.canAccessAdminPanel,
        // New granular permission system
        userRoles: user.userRoles || ['user'],
        characterRoles: user.characterRoles || ['personaggio'],
        characterPermissions: user.characterPermissions || []
      };

      const newAuthToken = CryptoUtils.generateAuthToken(tokenPayload, '24h');
      
      // Set new auth cookie
      AuthMiddleware.setAuthCookie(res, newAuthToken);

      res.json(successResponse(
        {
          session: {
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            refreshedAt: new Date().toISOString()
          }
        },
        'Session refreshed successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Token refresh error:', error);
      
      res.status(500).json(errorResponse(
        'Aggiornamento token fallito',
        'REFRESH_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /auth/session
   * Verify current session validity
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const character = req.character;

      res.json(successResponse(
        {
          valid: true,
          user: {
            id: user.userId,
            username: user.username,
            canAccessAdminPanel: user.canAccessAdminPanel
          },
          character: character ? {
            id: character.characterId,
            name: character.characterName,
            status: 'APPROVED'
          } : null,
          session: {
            expiresAt: new Date(user.exp * 1000).toISOString(),
            timeRemaining: `${Math.floor((user.exp * 1000 - Date.now()) / (1000 * 60 * 60))} hours ${Math.floor(((user.exp * 1000 - Date.now()) % (1000 * 60 * 60)) / (1000 * 60))} minutes`
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Session check error:', error);
      
      res.status(500).json(errorResponse(
        'Controllo sessione fallito',
        'SESSION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

        // Publish Redis event
        await redis.publish('auth:user_logout', {
          userId: user.userId,
          username: user.username,
          logoutAt: new Date().toISOString(),
          reason: reason || 'user_initiated'
        });

        // Invalidate any active character sessions for this user
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

      res.json(successResponse(
        {
          session: {
            loggedOutAt: new Date().toISOString(),
            allDevicesLoggedOut: logoutAllDevices || false
          },
        },
        'Logged out successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Logout error:', error);
      
      // Clear cookies anyway
      AuthMiddleware.clearAuthCookies(res);
      
      res.status(500).json(errorResponse(
        'Logout fallito',
        'LOGOUT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /auth/logout-all
   * Terminate all user sessions
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // TODO: Implement session invalidation in Redis when session management is fully implemented
      // For now, just clear current session cookies

      logAuth('user_logout_all', user.userId, {
        username: user.username,
        ipAddress: req.ip
      });

      // Clear authentication cookies
      AuthMiddleware.clearAuthCookies(res);

      res.json(successResponse(
        {
          sessionsTerminated: 1, // Placeholder
          terminatedAt: new Date().toISOString()
        },
        'All sessions terminated successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Logout all error:', error);
      
      res.status(500).json(errorResponse(
        'Logout completo fallito',
        'LOGOUT_ALL_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}