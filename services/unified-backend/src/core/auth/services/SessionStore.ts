import { redis } from '@config/runtime/redis';
import { logger } from '../logger';
import crypto from 'crypto';
import type { DeviceInfo } from '../types/auth';

/**
 * SessionDeviceInfo - Merge di DeviceInfo (device) + LocationInfo (ipAddress)
 * SessionStore richiede entrambi per tracking completo
 */
export interface SessionDeviceInfo extends DeviceInfo {
  ipAddress: string;
}

export interface SessionData {
  userId: string;
  characterId: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    ipAddress: string;
    userAgent?: string;
  };
  createdAt: number;
  lastActiveAt: number;
}

/**
 * SessionStore - Gestione sessioni character in Redis
 *
 * Pattern: Hybrid Server-Side Session + sessionStorage
 * - sessionId opaco (UUID) salvato in sessionStorage (frontend)
 * - Session data in Redis con TTL 24h
 * - Ownership validation: session.userId === auth_token.userId
 *
 * Security:
 * - sessionId è opaco (no data leakage se rubato via XSS)
 * - Ownership validation impedisce session hijacking cross-user
 * - auth_token httpOnly cookie protegge userId
 */
export class SessionStore {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user:sessions:'; // NEW: User session index
  private static readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Genera sessionId univoco (UUID v4)
   */
  private static generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Crea nuova session in Redis
   *
   * @param userId - User ID (da auth_token)
   * @param characterId - Character ID selezionato
   * @param deviceInfo - Device metadata
   * @param tabId - (Opzionale) Tab ID per debugging
   * @returns sessionId - UUID opaco
   */
  static async createSession(
    userId: string,
    characterId: string,
    deviceInfo: SessionDeviceInfo,
    tabId?: string
  ): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const key = `${this.SESSION_PREFIX}${sessionId}`;

      const sessionData: SessionData = {
        userId,
        characterId,
        deviceInfo: {
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          deviceType: deviceInfo.deviceType || 'desktop',
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent
        },
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;

      // ✅ NEW: Atomic operation - save session + add to user index
      const client = redis.getClient();
      await client.multi()
        .setEx(key, this.DEFAULT_TTL, JSON.stringify(sessionData))
        .sAdd(userSessionsKey, sessionId) // Add to user session SET
        .expire(userSessionsKey, this.DEFAULT_TTL) // TTL matches session
        .exec();

      logger.info('Session created with user index', {
        sessionId,
        userId,
        characterId,
        deviceType: deviceInfo.deviceType,
        ipAddress: deviceInfo.ipAddress,
        tabId,
        ttl: this.DEFAULT_TTL
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session', { error, userId, characterId });
      throw new Error('Session creation failed');
    }
  }

  /**
   * Recupera session da Redis
   *
   * @param sessionId - UUID session
   * @returns SessionData | null (se non esiste o scaduta)
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(data);
      return sessionData;
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId });
      return null;
    }
  }

  /**
   * Elimina session da Redis
   *
   * @param sessionId - UUID session
   * @returns true se eliminata, false se non esisteva
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;

      // ✅ NEW: Get session first to find userId (needed for index cleanup)
      const session = await this.getSession(sessionId);
      if (!session) {
        return false; // Already deleted
      }

      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${session.userId}`;

      // ✅ NEW: Atomic operation - delete session + remove from user index
      const client = redis.getClient();
      await client.multi()
        .del(key)
        .sRem(userSessionsKey, sessionId) // Remove from user session SET
        .exec();

      logger.info('Session deleted with user index cleanup', {
        sessionId,
        userId: session.userId
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId });
      return false;
    }
  }

  /**
   * Valida ownership session (security critical)
   *
   * @param sessionId - UUID session
   * @param userId - User ID da auth_token (httpOnly cookie)
   * @returns true se session esiste E userId match
   */
  static async validateSessionOwnership(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        return false;
      }

      const isOwner = session.userId === userId;

      if (!isOwner) {
        logger.warn('Session ownership mismatch', {
          sessionId,
          expectedUserId: userId,
          actualUserId: session.userId
        });
      }

      return isOwner;
    } catch (error) {
      logger.error('Failed to validate session ownership', { error, sessionId, userId });
      return false;
    }
  }

  /**
   * Aggiorna lastActiveAt timestamp (activity tracking)
   *
   * @param sessionId - UUID session
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const data = await redis.get(key);

      if (!data) {
        return; // Session non esiste o scaduta
      }

      const sessionData: SessionData = JSON.parse(data);
      sessionData.lastActiveAt = Date.now();

      // Aggiorna Redis (mantiene TTL originale automaticamente con update)
      await redis.set(key, JSON.stringify(sessionData), this.DEFAULT_TTL);
    } catch (error) {
      logger.error('Failed to update session activity', { error, sessionId });
      // Non-blocking error - continua senza throw
    }
  }

  /**
   * Recupera tutte le sessioni attive di un utente
   *
   * ✅ FIXED: Uses user session index (Redis SET) for O(1) lookup
   *
   * @param userId - User ID
   * @returns Array di sessionId
   */
  static async getUserSessions(userId: string): Promise<string[]> {
    try {
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
      const client = redis.getClient();
      const sessionIds = await client.sMembers(userSessionsKey);

      return sessionIds || [];
    } catch (error) {
      logger.error('Failed to get user sessions', { error, userId });
      return [];
    }
  }

  /**
   * Elimina tutte le sessioni di un utente (logout globale)
   *
   * ✅ FIXED: Deletes all sessions efficiently using user session index
   *
   * @param userId - User ID
   * @returns Numero di sessioni eliminate
   */
  static async deleteUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessions(userId);

      if (sessionIds.length === 0) {
        return 0;
      }

      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
      const sessionKeys = sessionIds.map(id => `${this.SESSION_PREFIX}${id}`);

      // ✅ Atomic operation: delete all sessions + user index
      const client = redis.getClient();
      await client.multi()
        .del(sessionKeys)
        .del(userSessionsKey)
        .exec();

      logger.info('All user sessions deleted', {
        userId,
        count: sessionIds.length
      });

      return sessionIds.length;
    } catch (error) {
      logger.error('Failed to delete user sessions', { error, userId });
      return 0;
    }
  }

  /**
   * Cleanup sessioni scadute (cron job)
   *
   * NOTE: Redis TTL auto-cleanup handles expiry automatically
   * This method is not needed in current implementation
   */
  static async cleanupExpiredSessions(): Promise<number> {
    logger.info('Redis TTL auto-cleanup handles expired sessions - manual cleanup not needed');
    return 0;
  }
}
