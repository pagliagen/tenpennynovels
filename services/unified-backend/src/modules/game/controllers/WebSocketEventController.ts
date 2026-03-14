import { Request, Response } from 'express';
import { WebSocketEvent } from '@database/models';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

/**
 * WebSocket Event Controller
 *
 * ✅ SPRINT 4 - WebSocket Event Replay
 *
 * Provides endpoints for retrieving missed WebSocket events after reconnection.
 */
export class WebSocketEventController {
  /**
   * GET /game/events/since/:lastEventId
   *
   * Retrieve all events since a specific eventId for the authenticated character.
   * Used for event replay after WebSocket reconnection.
   */
  static async getEventsSince(req: Request<{ lastEventId: string }>, res: Response): Promise<void> {
    try {
      const { lastEventId } = req.params;
      const characterId = req.character!.characterId;
      const limit = parseInt(req.query.limit as string) || 100;

      // Validate lastEventId
      const lastEventIdNum = parseInt(lastEventId);
      if (isNaN(lastEventIdNum) || lastEventIdNum < 0) {
        res.status(400).json(errorResponse(
          'Invalid lastEventId - must be a positive number',
          'INVALID_EVENT_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate limit
      if (limit < 1 || limit > 500) {
        res.status(400).json(errorResponse(
          'Invalid limit - must be between 1 and 500',
          'INVALID_LIMIT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info('📡 WebSocket: Retrieving events for replay', {
        characterId,
        lastEventId: lastEventIdNum,
        limit
      });

      // Get events since lastEventId for this character
      const events = await (WebSocketEvent as any).getEventsSince(
        lastEventIdNum,
        characterId,
        limit
      );

      // Transform events for frontend (remove MongoDB internal fields)
      const eventsForReplay = events.map((event: any) => ({
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt
      }));

      logger.info('✅ WebSocket: Events retrieved for replay', {
        characterId,
        lastEventId: lastEventIdNum,
        eventsFound: eventsForReplay.length,
        latestEventId: eventsForReplay.length > 0 ? eventsForReplay[eventsForReplay.length - 1].eventId : null
      });

      res.json(successResponse(
        {
          events: eventsForReplay,
          count: eventsForReplay.length,
          lastEventId: lastEventIdNum,
          latestEventId: eventsForReplay.length > 0 ? eventsForReplay[eventsForReplay.length - 1].eventId : lastEventIdNum
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('❌ WebSocket: Failed to retrieve events:', {
        message: err.message,
        stack: err.stack,
        characterId: req.character?.characterId
      });

      res.status(500).json(errorResponse(
        'Failed to retrieve events',
        'GET_EVENTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/events/latest
   *
   * Get the latest event ID (for initialization).
   * Used to set initial lastEventId when character first connects.
   */
  static async getLatestEventId(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get latest event (highest eventId)
      const latestEvent = await WebSocketEvent.findOne()
        .sort({ eventId: -1 })
        .select('eventId')
        .exec();

      const latestEventId = latestEvent ? latestEvent.eventId : 0;

      logger.info('📡 WebSocket: Retrieved latest eventId', {
        characterId,
        latestEventId
      });

      res.json(successResponse(
        {
          latestEventId
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('❌ WebSocket: Failed to retrieve latest eventId:', {
        message: err.message,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Failed to retrieve latest eventId',
        'GET_LATEST_EVENT_ID_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
