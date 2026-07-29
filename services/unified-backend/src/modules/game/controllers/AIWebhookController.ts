import { Request, Response } from 'express';
import { Chat, Location, Character, GamingSession } from '@database/models';
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
      const { requestId, botId, botName, botCharacterId, locationId, response, metadata } = req.body;

      if (!requestId || !response || !locationId) {
        logger.warn('[AIWebhook] Invalid callback payload', {
          requestId,
          hasResponse: !!response,
          responseLength: typeof response === 'string' ? response.length : undefined,
          hasLocationId: !!locationId,
          locationId,
          bodyKeys: Object.keys(req.body),
        });
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

      // Resolve bot character: prefer explicit ID, fallback to bot_id lookup
      let character = null;
      if (botCharacterId) {
        character = await Character.findById(botCharacterId);
      }
      if (!character && botId) {
        character = await Character.findOne({ bot_id: botId, isBot: true }).lean();
      }

      // Use the position from the triggering action (requestId = action._id)
      let triggerPosition: string | undefined;
      try {
        const triggerAction = await Chat.findById(requestId).select('position').lean();
        triggerPosition = (triggerAction as any)?.position;
      } catch {
        // requestId might not be a valid ObjectId in edge cases — ignore
      }
      const defaultPosition = triggerPosition
        || ((location.positions && location.positions.length > 0) ? location.positions[0].name : undefined);

      const resolvedCharacterId = (character as any)?._id?.toString() || botCharacterId || undefined;

      if (!resolvedCharacterId) {
        logger.error(`[AIWebhook] Cannot resolve bot character for bot_id=${botId}, botCharacterId=${botCharacterId}`);
        res.status(500).json({ success: false, error: 'Personaggio bot non trovato' });
        return;
      }

      const action = await Chat.create({
        locationId,
        characterId: resolvedCharacterId,
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
        const roomName = `location_${locationId}`;
        const chatMessage = {
          _id: action._id.toString(),
          actionType: action.actionType,
          characterId: resolvedCharacterId,
          characterName: (character as any)?.name || botName || 'Bot',
          characterAvatar: (character as any)?.avatar || undefined,
          position: defaultPosition || undefined,
          locationId: action.locationId.toString(),
          content: response,
          isBot: true,
          visibility: 'public',
          timestamp: action.timestamp?.toISOString?.() ?? new Date().toISOString(),
        };
        const notification = {
          message: chatMessage,
          locationId,
          locationName: location.name || 'Location',
          locationSlug: (location as any).slug || null,
        };
        const room = io.sockets.adapter.rooms.get(roomName);
        logger.info(`[AIWebhook] Emitting location_message_notification to ${roomName} (clients: ${room?.size ?? 0})`);
        io.to(roomName).emit('location_message_notification', notification);
      }

      logger.info(`[AIWebhook] Bot action created: ${action._id}`);

      // Advance TurnManager if an active session exists for this location
      try {
        const freshLocation = await Location.findById(locationId).select('activeSession botRound').lean();
        const sessionId = freshLocation?.activeSession?.sessionId;
        if (sessionId) {
          const { turnManager } = await import('../services/TurnManager');
          await turnManager.completeBotTurn(sessionId);
          logger.info(`[AIWebhook] Bot turn completed for session ${sessionId}`);
        }

        // Emit round_reset so clients can update UI state
        if (io) {
          const roundNumber = freshLocation?.botRound?.roundNumber ?? 0;
          io.to(`location_${locationId}`).emit('round_reset', {
            locationId,
            roundNumber,
          });
        }
      } catch (turnError: any) {
        logger.warn(`[AIWebhook] Turn/round cleanup error (non-blocking): ${turnError.message}`);
      }

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
