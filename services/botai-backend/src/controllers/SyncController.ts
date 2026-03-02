import { Request, Response } from 'express';
import { DatabaseContext } from '../services/DatabaseContext';
import { getEnvironmentFromRequest } from '../middleware/environmentDetection';
import { botDecisionService } from '../services/BotDecisionService';
import { characterSnapshotService } from '../services/CharacterSnapshotService';
import { logger } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/apiResponse';

export class SyncController {
  /**
   * POST /sync/action
   * Riceve notifica di nuova azione da game-backend
   */
  static async receiveAction(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);

      logger.info(`[Sync] Processing action in ${environment} environment (${dbContext.getDatabaseName()})`);

      const { eventType, timestamp, sessionId, data } = req.body;

      if (eventType !== 'location_action_created') {
        res.status(400).json(errorResponse('Invalid event type', 'INVALID_EVENT_TYPE'));
        return;
      }

      if (!data || !data.actionId || !data.locationId) {
        res.status(400).json(errorResponse(
          'Missing required fields',
          'MISSING_FIELDS'
        ));
        return;
      }

      logger.info(`[Sync] Received action ${data.actionId} for location ${data.locationId}`);

      // Rispondi immediatamente OK per non bloccare game-backend
      res.json(successResponse({ received: true }));

      // Processa azione in background (non bloccare risposta)
      setImmediate(async () => {
        try {
          await botDecisionService.processLocationAction(data, sessionId, dbContext);
        } catch (error) {
          logger.error('[Sync] Error processing action:', error);
        }
      });

    } catch (error: any) {
      logger.error('[Sync] Error in receiveAction:', error);
      res.status(500).json(errorResponse('Internal error', 'SYNC_ERROR'));
    }
  }

  /**
   * POST /sync/character
   * Riceve aggiornamento personaggio da game-backend
   */
  static async receiveCharacterUpdate(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);

      const { eventType, timestamp, data } = req.body;

      if (eventType !== 'character_updated') {
        res.status(400).json(errorResponse('Invalid event type', 'INVALID_EVENT_TYPE'));
        return;
      }

      if (!data || !data.characterId) {
        res.status(400).json(errorResponse(
          'Missing characterId',
          'MISSING_CHARACTER_ID'
        ));
        return;
      }

      logger.debug(`[Sync] Received character update for ${data.characterId} in ${environment} environment`);

      // Rispondi immediatamente OK
      res.json(successResponse({ received: true }));

      // Aggiorna snapshot in background
      setImmediate(async () => {
        try {
          await characterSnapshotService.updateSnapshot(data, dbContext);
        } catch (error) {
          logger.error('[Sync] Error updating character snapshot:', error);
        }
      });

    } catch (error: any) {
      logger.error('[Sync] Error in receiveCharacterUpdate:', error);
      res.status(500).json(errorResponse('Internal error', 'SYNC_ERROR'));
    }
  }

  /**
   * GET /sync/status
   * Get sync status and statistics
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Add statistics gathering
      const status = {
        actionsProcessed: 0, // Implement counter
        lastActionAt: null,
        charactersInCache: 0,
        uptime: process.uptime()
      };

      res.json(successResponse(status));
    } catch (error: any) {
      logger.error('[Sync] Error getting status:', error);
      res.status(500).json(errorResponse('Failed to get status', 'STATUS_ERROR'));
    }
  }
}
