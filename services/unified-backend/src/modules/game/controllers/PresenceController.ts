import { Request, Response } from 'express';
import { Character } from '../../../database/models/Character';
import { Location } from '../../../database/models/Location';
import { logger } from '../utils/logger';
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
   * Called via navigator.sendBeacon (cookie-based auth).
   */
  static async leave(req: Request, res: Response): Promise<void> {
    try {
      const character = (req as any).character;

      if (!character || !character.characterId) {
        res.status(401).json({
          result: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Character context required'
          }
        });
        return;
      }

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

      logger.info(`[PresenceController] Character ${characterName} (${characterId}) left presence system`);

      res.status(200).json({
        result: true,
        data: {
          characterId,
          leftAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('[PresenceController] Leave endpoint error:', error);
      res.status(500).json({
        result: false,
        error: {
          code: 'PRESENCE_LEAVE_FAILED',
          message: 'Failed to process leave request'
        }
      });
    }
  }
}
