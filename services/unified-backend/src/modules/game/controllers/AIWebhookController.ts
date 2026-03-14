import { Request, Response } from 'express';
import { Chat, Location, Character } from '@database/models';
import { logger } from '../logger';
import { getSocketIO } from '../websocket/socketInstance';

export class AIWebhookController {
  /**
   * POST /game/webhooks/bot-response
   *
   * Receives the callback from local-ai when a bot response is ready.
   * Creates a location action with the bot's response.
   *
   * Expected payload (defined by local-ai):
   * {
   *   requestId: string;
   *   botId: string;
   *   botName: string;
   *   botCharacterId: string;
   *   locationId: string;
   *   response: string;
   *   metadata: { model: string; tokensUsed: number; processingMs: number }
   * }
   */
  static async handleBotResponse(req: Request, res: Response): Promise<void> {
    try {
      const { requestId, botName, botCharacterId, locationId, response, metadata } = req.body;

      if (!requestId || !response || !locationId) {
        logger.warn('[AIWebhook] Invalid callback payload', { requestId });
        res.status(400).json({ success: false, error: 'Campi obbligatori mancanti' });
        return;
      }

      logger.info(`[AIWebhook] Bot response received`, {
        requestId,
        botName,
        locationId,
        responseLength: response.length,
        processingMs: metadata?.processingMs,
      });

      const location = await Location.findById(locationId);
      if (!location) {
        logger.error(`[AIWebhook] Location not found: ${locationId}`);
        res.status(404).json({ success: false, error: 'Location non trovata' });
        return;
      }

      let character = null;
      if (botCharacterId) {
        character = await Character.findById(botCharacterId);
      }

      const defaultPosition = (location.positions && location.positions.length > 0) ? location.positions[0] : undefined;

      const action = await Chat.create({
        locationId,
        characterId: botCharacterId || '',
        characterName: character?.name || botName || 'Bot',
        isBot: true,
        actionType: 'standard',
        content: response,
        position: defaultPosition,
        visibility: 'public',
        timestamp: new Date(),
      });

      const io = getSocketIO();
      if (io) {
        io.to(`location_${locationId}`).emit('location_action', {
          action: {
            _id: action._id.toString(),
            locationId,
            characterId: botCharacterId,
            characterName: character?.name || botName,
            characterAvatar: character?.avatar,
            isBot: true,
            actionType: 'standard',
            content: response,
            position: defaultPosition,
            visibility: 'public',
            timestamp: action.timestamp,
          },
        });
      }

      logger.info(`[AIWebhook] Bot action created: ${action._id}`);

      res.json({
        success: true,
        data: { actionId: action._id.toString(), requestId },
      });
    } catch (error: any) {
      logger.error('[AIWebhook] Error handling bot response:', error);
      res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
  }
}
