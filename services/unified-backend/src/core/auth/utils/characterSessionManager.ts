import { CharacterSession } from '../models/CharacterSession';
import { Character } from '@core/character/models/Character';
import { DeviceInfo } from '../types/auth';
import { logger } from '../logger';
import crypto from 'crypto';
import type { UpdateWriteOpResult } from 'mongoose';
import { CryptoUtils } from './crypto';
import { AuthMiddleware } from '../middleware/auth';
import type { Response } from 'express';
import { redis } from '@config/runtime/redis';

interface CharacterSessionStatics {
  invalidateCharacterSessions(characterId: string, reason?: string, fromIp?: string): Promise<UpdateWriteOpResult>;
  getUserActiveSessions(userId: string): Promise<Array<{ sessionId: string; characterId: string }>>;
  cleanupExpiredSessions(): Promise<UpdateWriteOpResult>;
}

const CharacterSessionModel = CharacterSession as typeof CharacterSession & CharacterSessionStatics;

export class CharacterSessionManager {
  /**
   * Create a new character session and invalidate any existing ones
   */
  static async createCharacterSession(
    characterId: string,
    userId: string,
    token: string,
    deviceInfo: DeviceInfo,
    ipAddress: string,
    expiresIn: string = '24h'
  ): Promise<string> {
    try {
      // Generate unique session ID
      const sessionId = crypto.randomBytes(32).toString('hex');

      // Hash the token for security
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Calculate expiration date
      const expirationMs = this.parseExpirationTime(expiresIn);
      const expiresAt = new Date(Date.now() + expirationMs);

      // MULTI-TAB SUPPORT: Non invalidiamo più le sessioni precedenti
      // Ogni tab può avere la propria sessione attiva contemporaneamente
      // L'invalidazione viene gestita solo al logout esplicito

      // Create new session
      const session = new CharacterSession({
        characterId,
        userId,
        sessionId,
        tokenHash,
        deviceInfo: {
          userAgent: deviceInfo.userAgent || 'Unknown',
          ipAddress,
          deviceName: deviceInfo.deviceName,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          deviceType: deviceInfo.deviceType || 'desktop'
        },
        isActive: true,
        expiresAt,
        lastActiveAt: new Date()
      });

      await session.save();

      logger.info('Character session created', {
        sessionId,
        characterId,
        userId,
        ipAddress,
        expiresAt
      });

      return sessionId;

    } catch (error: any) {
      logger.error('Failed to create character session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate if a character session is still active and unique
   */
  static async validateCharacterSession(
    characterId: string,
    token: string
  ): Promise<{ valid: boolean; session?: any; reason?: string }> {
    try {
      // Hash the token to compare
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find active session for this character
      const session = await CharacterSession.findOne({
        characterId,
        tokenHash,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        return {
          valid: false,
          reason: 'No active session found or session expired'
        };
      }

      // Update last activity
      await session.updateActivity();

      return {
        valid: true,
        session
      };

    } catch (error: any) {
      logger.error('Session validation failed:', error);
      return {
        valid: false,
        reason: 'Session validation error'
      };
    }
  }

  /**
   * Invalidate a character session
   */
  static async invalidateSession(
    sessionId: string,
    reason: string = 'manual',
    fromIp?: string
  ): Promise<boolean> {
    try {
      const session = await CharacterSession.findOne({
        sessionId,
        isActive: true
      });

      if (!session) {
        return false;
      }

      await session.invalidate(reason, fromIp);

      logger.info('Character session invalidated', {
        sessionId,
        characterId: session.characterId,
        reason,
        fromIp
      });

      return true;

    } catch (error: any) {
      logger.error('Failed to invalidate session:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getUserActiveSessions(userId: string): Promise<any[]> {
    try {
      return await CharacterSessionModel.getUserActiveSessions(userId);
    } catch (error: any) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await CharacterSessionModel.cleanupExpiredSessions();

      if (result.modifiedCount > 0) {
        logger.info(`Cleaned up ${result.modifiedCount} expired character sessions`);
      }

      return result.modifiedCount;

    } catch (error: any) {
      logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Centralized method to activate character and set context cookie
   * Used by both login and character selection
   *
   * @returns {string} Character token that was generated
   */
  static async activateCharacterContext(
    res: Response,
    character: any, // Character document
    userId: string,
    deviceInfo: DeviceInfo,
    ipAddress: string,
    expiresIn: string = '24h'
  ): Promise<string> {
    try {
      // Deactivate other characters for this user
      await Character.updateMany(
        { userId: userId, _id: { $ne: character._id } },
        { isActive: false }
      );

      // Activate selected character
      character.isActive = true;
      character.lastActive = new Date();
      await character.save();

      // Generate character context token
      const characterToken = CryptoUtils.generateCharacterContextToken({
        characterId: character.id,
        characterName: character.name,
        userId: userId,
        gameplayRoles: character.gameplayRoles || [],
        isApproved: character.playerStatus === 'approved',
        isGestore: character.isGestore || false,
        playerStatus: character.playerStatus || 'draft',
        characterPermissions: character.characterPermissions || []
      });

      // Create character session (invalidates any existing sessions for this character)
      await this.createCharacterSession(
        character.id,
        userId,
        characterToken,
        deviceInfo,
        ipAddress,
        expiresIn
      );

      // Set character context cookie
      AuthMiddleware.setCharacterCookie(res, characterToken);

      // Publish character activation event to Redis
      await redis.publish('user:events', JSON.stringify({
        type: 'user_character_selected',
        userId: userId,
        characterId: character.id,
        characterName: character.name,
        timestamp: new Date().toISOString()
      }));

      logger.info('Character context activated', {
        characterId: character.id,
        userId,
        name: character.name
      });

      return characterToken;

    } catch (error: any) {
      logger.error('Failed to activate character context:', error);
      throw new Error('Character context activation failed');
    }
  }

  /**
   * Parse expiration time string to milliseconds
   */
  private static parseExpirationTime(expiresIn: string): number {
    const timeMap: { [key: string]: number } = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };

    const match = expiresIn.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Invalid expiration time format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    return Number.parseInt(value) * timeMap[unit];
  }
}