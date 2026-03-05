import jwt from 'jsonwebtoken';
import { logger } from './logger';

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  canAccessAdminPanel: boolean;
  characterId?: string;
  iat?: number;
  exp?: number;
}

export class AuthUtils {
  private static getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
  }

  /**
   * Decode and validate JWT token from cookies
   */
  static decodeAuthToken(authToken: string): JWTPayload {
    try {
      const decoded = jwt.verify(authToken, this.getJwtSecret()) as JWTPayload;
      
      if (!decoded.userId || !decoded.username || !decoded.email) {
        throw new Error('Invalid token payload - missing required fields');
      }

      return decoded;
    } catch (error: any) {
      logger.warn('JWT token validation failed:', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Invalid authentication token');
    }
  }

  /**
   * Extract character context from character_context cookie
   */
  static decodeCharacterContext(characterContext: string): { characterId: string; characterName: string; characterRoles: string[] } | null {
    try {
      const decoded = jwt.verify(characterContext, this.getJwtSecret()) as any;
      return {
        characterId: decoded.characterId,
        characterName: decoded.characterName, // Include character name from JWT
        characterRoles: decoded.characterRoles || []
      };
    } catch (error: any) {
      logger.warn('Character context token validation failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Create a safe user object without sensitive data
   */
  static createSafeUserObject(user: any, character?: any) {
    const safeUser = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      canAccessAdminPanel: user.canAccessAdminPanel,
      multipleCharactersAllowed: user.multipleCharactersAllowed,
      firstName: user.displayName?.split(' ')[0] || user.username,
      lastName: user.displayName?.split(' ')[1] || '',
      avatarUrl: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}&background=d4af37&color=1a1a1a&size=128&font-size=0.6`,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };

    return safeUser;
  }

  /**
   * Create a safe character object without sensitive data
   */
  static createSafeCharacterObject(character: any) {
    if (!character) return null;

    return {
      id: character._id.toString(),
      name: character.name,
      surname: character.surname,
      playerStatus: character.playerStatus,
      gameplayRoles: character.gameplayRoles || [],
      userId: character.userId.toString(),
      createdAt: character.createdAt,
      approvedAt: character.approvedAt,
      approvedBy: character.approvedBy,
      avatarUrl: character.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name + (character.surname ? ' ' + character.surname : ''))}&background=d4af37&color=1a1a1a&size=128&font-size=0.6`
    };
  }

  /**
   * Get character switching context based on user settings
   */
  static getAvailableCharacters(allCharacters: any[], multipleCharactersAllowed: boolean) {
    if (!multipleCharactersAllowed && allCharacters.length > 0) {
      return [allCharacters[0]]; // Return only first character for single-character users
    }
    return allCharacters;
  }

  /**
   * Determine active character based on request parameters
   */
  static determineActiveCharacter(
    availableCharacters: any[], 
    requestedCharacterId?: string, 
    characterContext?: { characterId: string; characterRoles: string[] } | null
  ) {
    let selectedCharacter = null;

    if (requestedCharacterId) {
      // Use requested character ID (from management panel character switching)
      selectedCharacter = availableCharacters.find(char => char._id.toString() === requestedCharacterId);
      if (selectedCharacter) {
        logger.info('Using requested character:', { 
          characterId: selectedCharacter._id,
          name: selectedCharacter.name 
        });
      } else {
        logger.warn('Requested character not found or not available:', { requestedCharacterId });
      }
    } else if (characterContext) {
      // Use character from context or first available
      selectedCharacter = availableCharacters.find(char => 
        char._id.toString() === characterContext.characterId
      ) || (availableCharacters.length > 0 ? availableCharacters[0] : null);
      
      if (selectedCharacter) {
        logger.info('Using character from context:', { 
          characterId: selectedCharacter._id,
          name: selectedCharacter.name 
        });
      }
    } else if (availableCharacters.length > 0) {
      // Use first available character as fallback
      selectedCharacter = availableCharacters[0];
      logger.info('Using first available character as fallback:', { 
        characterId: selectedCharacter._id,
        name: selectedCharacter.name 
      });
    }

    return selectedCharacter;
  }
}