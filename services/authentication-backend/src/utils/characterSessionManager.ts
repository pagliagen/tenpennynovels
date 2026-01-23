import { CharacterSession } from '../../../database/models';
import { DeviceInfo } from '../types/auth';
import { logger } from './logger';
import crypto from 'crypto';

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

      // Invalidate any existing active sessions for this character
      await (CharacterSession as any).invalidateCharacterSessions(
        characterId,
        'new_device_login',
        ipAddress
      );

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
      return await (CharacterSession as any).getUserActiveSessions(userId);
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
      const result = await (CharacterSession as any).cleanupExpiredSessions();

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
    return parseInt(value) * timeMap[unit];
  }
}