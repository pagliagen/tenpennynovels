import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { Location } from '../../../database/models/Location';
import { logger } from '../logger';
import { getSocketIO } from '../websocket/socketInstance';

/**
 * Presence Controller
 *
 * Handles presence-related endpoints for beforeunload cleanup.
 * Heartbeat is handled via WebSocket ping (see gameHandlers.ts).
 */
export class PresenceController {
  /**
   * POST /game/presence/leave
   *
   * Immediate cleanup when user closes tab (beforeunload).
   * Called via navigator.sendBeacon.
   *
   * NEW FLOW (Multi-Tab Support):
   * - Read sessionId from header X-Session-Id OR body.sessionId (sendBeacon compatibility)
   * - Lookup session in Redis
   * - Validate ownership (session.userId === auth_token.userId)
   * - Delete session from Redis
   * - Cleanup character presence (Character.currentLocation, Location.occupants)
   */
  static async leave(req: Request, res: Response): Promise<void> {
    try {
      // Import SessionStore dynamically
      const { SessionStore } = await import('@core/auth/services/SessionStore');

      // 1. Read sessionId from header OR body (sendBeacon sends in body)
      const sessionId = (req.headers['x-session-id'] as string) || req.body?.sessionId;

      if (!sessionId) {
        // Fallback: try old flow with req.character (backward compatibility)
        if (req.character?.characterId) {
          return this.legacyLeave(req, res);
        }

        res.status(400).json({
          result: false,
          error: {
            code: 'SESSION_ID_REQUIRED',
            message: 'Session ID richiesto'
          }
        });
        return;
      }

      // 2. Lookup Redis session
      const session = await SessionStore.getSession(sessionId);

      if (!session) {
        logger.warn('[PresenceController] Session not found for cleanup', { sessionId });
        res.status(404).json({
          result: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Sessione non trovata'
          }
        });
        return;
      }

      // 3. OPTIONAL: Validate ownership (if user is authenticated)
      // Note: sendBeacon includes auth_token cookie, but no explicit userId in session
      // We trust the sessionId is valid (already validated by Redis lookup)
      if (req.user && session.userId !== req.user.userId) {
        logger.warn('[PresenceController] Session ownership mismatch', {
          sessionId,
          sessionUserId: session.userId,
          requestUserId: req.user.userId
        });
        res.status(403).json({
          result: false,
          error: {
            code: 'SESSION_OWNERSHIP_MISMATCH',
            message: 'Sessione non valida per questo utente'
          }
        });
        return;
      }

      const characterId = session.characterId;

      // 4. Delete session from Redis
      await SessionStore.deleteSession(sessionId);

      // 5. Cleanup character presence (existing logic)
      const char = await Character.findById(characterId).select('currentLocation name surname');

      if (!char) {
        logger.warn('[PresenceController] Character not found for cleanup', { characterId, sessionId });
        res.status(404).json({
          result: false,
          error: {
            code: 'CHARACTER_NOT_FOUND',
            message: 'Personaggio non trovato'
          }
        });
        return;
      }

      const characterName = char.name;
      const currentLocation = char.currentLocation;

      // Clear Character.currentLocation
      await Character.findByIdAndUpdate(
        characterId,
        { $set: { currentLocation: null, lastActive: new Date() } }
      );

      // Remove from location.occupants[]
      if (currentLocation) {
        await Location.findByIdAndUpdate(
          currentLocation,
          { $pull: { occupants: { characterId } } }
        );

        // Emit WebSocket event
        try {
          const io = getSocketIO();

          if (io) {
            io.to(`location_${currentLocation}`).emit('player_left', {
              characterId,
              characterName,
              timestamp: new Date().toISOString(),
              reason: 'beforeunload'
            });
          } else {
            logger.warn('[PresenceController] Socket.IO not available, skipping WebSocket event');
          }
        } catch (err) {
          logger.warn('[PresenceController] WebSocket emit failed (non-critical):', err);
        }
      }

      logger.info(`[PresenceController] Character ${characterName} (${characterId}) left presence system (session ${sessionId})`);

      res.status(200).json({
        result: true,
        data: {
          characterId,
          sessionId,
          leftAt: new Date().toISOString()
        }
      });
    } catch (error: unknown) {
      logger.error('[PresenceController] Leave endpoint error:', error);
      res.status(500).json({
        result: false,
        error: {
          code: 'PRESENCE_LEAVE_FAILED',
          message: 'Impossibile elaborare la richiesta di uscita'
        }
      });
    }
  }

  /**
   * Legacy leave method (backward compatibility)
   * DEPRECATED: Use new sessionId-based flow
   */
  private static async legacyLeave(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character!;
      const characterId = character.characterId;
      const characterName = character.characterName;

      // Get current location before clearing
      const char = await Character.findById(characterId).select('currentLocation');
      const currentLocation = char?.currentLocation;

      // Clear Character.currentLocation
      await Character.findByIdAndUpdate(
        characterId,
        { $set: { currentLocation: null, lastActive: new Date() } }
      );

      // Remove from location.occupants[]
      if (currentLocation) {
        await Location.findByIdAndUpdate(
          currentLocation,
          { $pull: { occupants: { characterId } } }
        );

        // Emit WebSocket event
        try {
          const io = getSocketIO();

          if (io) {
            io.to(`location_${currentLocation}`).emit('player_left', {
              characterId,
              characterName,
              timestamp: new Date().toISOString(),
              reason: 'beforeunload'
            });
          } else {
            logger.warn('[PresenceController] Socket.IO not available, skipping WebSocket event');
          }
        } catch (err) {
          logger.warn('[PresenceController] WebSocket emit failed (non-critical):', err);
        }
      }

      logger.info(`[PresenceController] Character ${characterName} (${characterId}) left presence system (legacy)`);

      res.status(200).json({
        result: true,
        data: {
          characterId,
          leftAt: new Date().toISOString()
        }
      });
    } catch (error: unknown) {
      logger.error('[PresenceController] Legacy leave error:', error);
      res.status(500).json({
        result: false,
        error: {
          code: 'PRESENCE_LEAVE_FAILED',
          message: 'Impossibile elaborare la richiesta di uscita'
        }
      });
    }
  }
}
