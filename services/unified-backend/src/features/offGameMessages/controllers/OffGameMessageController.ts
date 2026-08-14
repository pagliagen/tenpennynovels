import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { OffGameMessage } from '../models/OffGameMessage';
import { OffGameMessageService } from '../services/OffGameMessageService';
import { OffGameThreadService } from '../services/OffGameThreadService';
import { logger } from '@shared/utils/logger';
import { successResponse, errorResponse, listResponse } from '@shared/utils/apiResponse';

/**
 * OffGameMessageController
 *
 * Controller for off-game chat (OOC) HTTP endpoints.
 *
 * Endpoints:
 * - POST /game/offgame-messages - Send message
 * - GET /game/offgame-threads - List threads (paginated)
 * - GET /game/offgame-threads/:id/messages - Get thread messages (paginated)
 * - PUT /game/offgame-messages/:id/read - Mark message as read
 * - POST /game/offgame-threads/:id/typing - Send typing indicator
 * - DELETE /game/offgame-messages/:id - Delete message
 */
export class OffGameMessageController {
  /**
   * POST /game/offgame-messages
   * Send off-game message
   *
   * Request body:
   * {
   *   recipientId: string,
   *   content: string,
   *   replyTo?: string
   * }
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { recipientId, content, replyTo } = req.body;

      // Validation
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      if (!recipientId || !content) {
        res.status(400).json(errorResponse(
          'Destinatario e contenuto sono obbligatori',
          'MISSING_REQUIRED_FIELDS'
        ));
        return;
      }

      // Send message via service
      const message = await OffGameMessageService.sendOffGameMessage({
        senderId: new mongoose.Types.ObjectId(req.character.characterId),
        recipientId: new mongoose.Types.ObjectId(recipientId),
        content,
        replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined
      });

      // TODO (Passo 5): Emit WebSocket event to recipient
      // io.to(`character:${recipientId}`).emit('offgame:message_received', { ... });

      res.status(201).json(successResponse(
        message,
        'Messaggio inviato con successo'
      ));
    } catch (error) {
      logger.error('Error sending OffGame message', { error, body: req.body });
      res.status(500).json(errorResponse(
        'Errore durante l\'invio del messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/offgame-threads
   * List threads (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 25)
   * - includeDeleted: boolean (default false)
   */
  static async listThreads(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const includeDeleted = req.query.includeDeleted === 'true';

      const result = await OffGameThreadService.listThreads(
        new mongoose.Types.ObjectId(req.character.characterId),
        includeDeleted,
        page,
        limit
      );

      res.status(200).json(successResponse({
        threads: result.threads,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      }));
    } catch (error) {
      logger.error('Error listing OffGame threads', { error, characterId: req.character?.characterId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei thread',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/offgame-threads/:id/messages
   * Get thread messages (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 50)
   */
  static async getThreadMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const threadId = req.params.id as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const { OffGameThread } = await import('../models/OffGameThread');

      // Get thread
      const thread = await OffGameThread.findById(threadId)
        .populate('participants', 'name surname avatar')
        .lean();

      if (!thread) {
        res.status(404).json(errorResponse(
          'Thread non trovato',
          'THREAD_NOT_FOUND'
        ));
        return;
      }

      // Verify character is participant
      const isParticipant = thread.participants.some((p: any) =>
        p._id.toString() === req.character!.characterId
      );

      if (!isParticipant) {
        res.status(403).json(errorResponse(
          'Non sei un partecipante di questo thread',
          'FORBIDDEN'
        ));
        return;
      }

      // Get messages (NOT soft-deleted)
      const query = {
        offGameThreadId: new mongoose.Types.ObjectId(threadId),
        deletedAt: null
      };

      const total = await OffGameMessage.countDocuments(query);
      const messages = await OffGameMessage.find(query)
        .populate('senderId', 'name surname avatar')
        .sort({ createdAt: 1 })  // Chronological order for chat
        .skip(skip)
        .limit(limit)
        .lean();

      // Mark messages as read
      const unreadMessages = messages.filter((msg: any) =>
        msg.senderId._id.toString() !== req.character!.characterId &&
        !msg.readBy?.some((r: any) => r.characterId?.toString() === req.character!.characterId)
      );

      for (const message of unreadMessages) {
        await OffGameMessage.findByIdAndUpdate(message._id, {
          $push: {
            readBy: {
              characterId: new mongoose.Types.ObjectId(req.character.characterId),
              readAt: new Date()
            }
          }
        });

        // TODO (Passo 5): Emit WebSocket read receipt to sender
        // io.to(`character:${message.senderId}`).emit('offgame:message_read', { ... });
      }

      // Reset unread count for this character
      await OffGameThreadService.resetUnreadCount(
        new mongoose.Types.ObjectId(threadId),
        new mongoose.Types.ObjectId(req.character.characterId)
      );

      res.status(200).json(successResponse({
        thread,
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }));
    } catch (error) {
      logger.error('Error fetching thread messages', { error, threadId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei messaggi',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * PUT /game/offgame-messages/:id/read
   * Mark message as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const messageId = req.params.id as string;
      const message = await OffGameMessage.findById(messageId);

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND'
        ));
        return;
      }

      // Check if already read
      const alreadyRead = message.readBy?.some(
        (r: any) => r.characterId?.toString() === req.character!.characterId
      );

      if (!alreadyRead) {
        await OffGameMessage.findByIdAndUpdate(messageId, {
          $push: {
            readBy: {
              characterId: new mongoose.Types.ObjectId(req.character.characterId),
              readAt: new Date()
            }
          }
        });

        // TODO (Passo 5): Emit WebSocket read receipt to sender
        // io.to(`character:${message.senderId}`).emit('offgame:message_read', { ... });

        logger.info('OffGame message marked as read', {
          messageId,
          characterId: req.character.characterId
        });
      }

      res.status(200).json(successResponse(
        undefined,
        'Messaggio segnato come letto'
      ));
    } catch (error) {
      logger.error('Error marking message as read', { error, messageId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante la marcatura del messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * POST /game/offgame-threads/:id/typing
   * Send typing indicator
   *
   * Throttle: Client should throttle to max 1 emit per 2 seconds
   */
  static async sendTypingIndicator(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const threadId = req.params.id as string;
      const { OffGameThread } = await import('../models/OffGameThread');

      // Verify thread exists and character is participant
      const thread = await OffGameThread.findById(threadId);

      if (!thread) {
        res.status(404).json(errorResponse(
          'Thread non trovato',
          'THREAD_NOT_FOUND'
        ));
        return;
      }

      const isParticipant = thread.participants.some((p: any) =>
        p.toString() === req.character!.characterId
      );

      if (!isParticipant) {
        res.status(403).json(errorResponse(
          'Non sei un partecipante di questo thread',
          'FORBIDDEN'
        ));
        return;
      }

      // Update typing indicator
      await OffGameThreadService.updateTypingIndicator(
        new mongoose.Types.ObjectId(threadId),
        new mongoose.Types.ObjectId(req.character.characterId)
      );

      // TODO (Passo 5): Emit WebSocket typing event to other participant
      // io.to(`character:${otherParticipantId}`).emit('offgame:typing_indicator', { ... });

      res.status(200).json(successResponse(
        undefined,
        'Indicatore di digitazione inviato'
      ));
    } catch (error) {
      logger.error('Error sending typing indicator', { error, threadId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante l\'invio dell\'indicatore',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * DELETE /game/offgame-messages/:id
   * Delete message (soft delete)
   *
   * Permissions: Only sender can delete, within 5 minutes of sending
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const messageId = req.params.id as string;
      const message = await OffGameMessage.findById(messageId);

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND'
        ));
        return;
      }

      const characterId = req.character.characterId;
      const isSender = message.senderId.toString() === characterId;

      if (!isSender) {
        res.status(403).json(errorResponse(
          'Solo il mittente può eliminare messaggi off-game',
          'FORBIDDEN'
        ));
        return;
      }

      // 5-minute time limit
      const now = Date.now();
      const createdAt = message.createdAt.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (now - createdAt > fiveMinutes) {
        res.status(403).json(errorResponse(
          'Non puoi eliminare messaggi inviati da più di 5 minuti',
          'DELETE_TIME_EXPIRED'
        ));
        return;
      }

      // Soft delete via MessageService
      await OffGameMessageService.deleteMessage(
        new mongoose.Types.ObjectId(messageId),
        new mongoose.Types.ObjectId(characterId)
      );

      res.status(200).json(successResponse(
        undefined,
        'Messaggio eliminato con successo'
      ));
    } catch (error) {
      logger.error('Error deleting OffGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante l\'eliminazione del messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }
}
