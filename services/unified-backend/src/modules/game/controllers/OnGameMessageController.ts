import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { OnGameMessage } from '@database/models/OnGameMessage';
import { MessageService } from '../services/MessageService';
import { OnGameThreadService } from '../services/OnGameThreadService';
import { logger } from '@shared/utils/logger';
import { successResponse, errorResponse, listResponse } from '@shared/utils/apiResponse';

/**
 * OnGameMessageController
 *
 * Controller for on-game postal system HTTP endpoints.
 *
 * Endpoints:
 * - POST /game/messages - Send message (multi-recipient support)
 * - GET /game/messages/inbox - List received messages (paginated)
 * - GET /game/messages/sent - List sent messages (paginated)
 * - GET /game/ongame-threads/:id - Get thread with messages
 * - DELETE /game/messages/:id - Soft delete message
 */
export class OnGameMessageController {
  /**
   * POST /game/messages
   * Send on-game message
   *
   * Multi-recipient support: Creates separate message + thread for each recipient
   *
   * Request body:
   * {
   *   recipientIds: string[],     // Character IDs
   *   messageType: string,        // 'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer'
   *   subject: string,
   *   content: string,
   *   replyTo?: string            // Message ID if replying
   * }
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { recipientIds, messageType, subject, content, replyTo } = req.body;

      // Validation
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        res.status(400).json(errorResponse(
          'Almeno un destinatario richiesto',
          'RECIPIENTS_REQUIRED'
        ));
        return;
      }

      if (!messageType || !subject || !content) {
        res.status(400).json(errorResponse(
          'Tipo messaggio, oggetto e contenuto sono obbligatori',
          'MISSING_REQUIRED_FIELDS'
        ));
        return;
      }

      // Get message type configuration from SystemConfiguration
      const { SystemConfiguration } = await import('@database/models/SystemConfiguration');
      const configKey = `postal_message_type_${messageType}`;
      const config = await SystemConfiguration.findOne({ configKey });

      if (!config || !config.value) {
        res.status(400).json(errorResponse(
          `Tipo di messaggio non valido: ${messageType}`,
          'INVALID_MESSAGE_TYPE'
        ));
        return;
      }

      const messageConfig = config.value as any;

      // Validate content length
      if (messageConfig.maxLength && content.length > messageConfig.maxLength) {
        res.status(400).json(errorResponse(
          `Contenuto troppo lungo (max ${messageConfig.maxLength} caratteri)`,
          'CONTENT_TOO_LONG'
        ));
        return;
      }

      // Validate max recipients for flyer
      if (messageConfig.allowMultipleRecipients && messageConfig.maxRecipients) {
        if (recipientIds.length > messageConfig.maxRecipients) {
          res.status(400).json(errorResponse(
            `Troppi destinatari (max ${messageConfig.maxRecipients})`,
            'TOO_MANY_RECIPIENTS'
          ));
          return;
        }
      }

      // Calculate total cost
      const totalCost = messageConfig.postageRequired * recipientIds.length;

      // Get sender character
      const { Character } = await import('@core/character/models/Character');
      const sender = await Character.findById(req.character.characterId);

      if (!sender) {
        res.status(404).json(errorResponse(
          'Personaggio mittente non trovato',
          'SENDER_NOT_FOUND'
        ));
        return;
      }

      // Validate credits
      if (sender.credits < totalCost) {
        res.status(400).json(errorResponse(
          `Crediti insufficienti (richiesti ${totalCost}, disponibili ${sender.credits})`,
          'INSUFFICIENT_CREDITS',
          { required: totalCost, available: sender.credits }
        ));
        return;
      }

      // Calculate delivery delay
      let deliveryDelay = 0;
      if (messageConfig.deliveryMode === 'realtime') {
        deliveryDelay = 0;
      } else if (messageConfig.deliveryMode === 'scheduled_fixed') {
        deliveryDelay = (messageConfig.deliveryTiming?.fixedDelayMinutes || 0) * 60 * 1000;
      } else if (messageConfig.deliveryMode === 'scheduled_variable') {
        const min = messageConfig.deliveryTiming?.variableDelayRange?.min || 0;
        const max = messageConfig.deliveryTiming?.variableDelayRange?.max || 0;
        const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
        deliveryDelay = randomMinutes * 60 * 1000;
      }

      // Create deliveryConfig snapshot (immutable to future config changes)
      const deliveryConfig = {
        deliveryDelay,
        cost: messageConfig.postageRequired,
        canReply: messageConfig.allowsReply ?? true,
        displayName: messageConfig.displayName
      };

      // Send message to each recipient (separate message + thread per recipient)
      const sentMessages: any[] = [];

      for (const recipientId of recipientIds) {
        try {
          const message = await MessageService.sendOnGameMessage({
            senderId: new mongoose.Types.ObjectId(req.character.characterId),
            recipientId: new mongoose.Types.ObjectId(recipientId),
            messageType,
            subject,
            content,
            deliveryConfig,
            replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined
          });

          sentMessages.push(message);

          logger.info('OnGame message sent', {
            messageId: message._id,
            senderId: req.character.characterId,
            recipientId,
            messageType
          });
        } catch (error) {
          logger.error('Failed to send message to recipient', {
            error,
            senderId: req.character.characterId,
            recipientId
          });
          // Continue with other recipients even if one fails
        }
      }

      if (sentMessages.length === 0) {
        res.status(500).json(errorResponse(
          'Impossibile inviare il messaggio a nessun destinatario',
          'SEND_FAILED'
        ));
        return;
      }

      res.status(201).json(successResponse(
        {
          sent: sentMessages.length,
          failed: recipientIds.length - sentMessages.length,
          messages: sentMessages,
          creditsSpent: totalCost
        },
        'Messaggio inviato con successo'
      ));
    } catch (error) {
      logger.error('Error sending OnGame message', { error, body: req.body });
      res.status(500).json(errorResponse(
        'Errore durante l\'invio del messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/messages/inbox
   * List received messages (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 25)
   */
  static async getInbox(req: Request, res: Response): Promise<void> {
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
      const skip = (page - 1) * limit;

      // Query: received messages (NOT deleted by recipient, deliveredAt exists)
      const query = {
        recipientId: new mongoose.Types.ObjectId(req.character.characterId),
        'deletedBy.recipient': { $exists: false },
        deliveredAt: { $exists: true }
      };

      const total = await OnGameMessage.countDocuments(query);
      const messages = await OnGameMessage.find(query)
        .populate('senderId', 'name surname avatar')
        .populate('onGameThreadId')
        .sort({ deliveredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(total / limit);

      res.status(200).json(listResponse(
        messages,
        {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      ));
    } catch (error) {
      logger.error('Error fetching inbox', { error, characterId: req.character?.characterId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento della posta in arrivo',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/messages/sent
   * List sent messages (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 25)
   */
  static async getSent(req: Request, res: Response): Promise<void> {
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
      const skip = (page - 1) * limit;

      // Query: sent messages (NOT deleted by sender)
      const query = {
        senderId: new mongoose.Types.ObjectId(req.character.characterId),
        'deletedBy.sender': { $exists: false }
      };

      const total = await OnGameMessage.countDocuments(query);
      const messages = await OnGameMessage.find(query)
        .populate('recipientId', 'name surname avatar')
        .populate('onGameThreadId')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(total / limit);

      res.status(200).json(listResponse(
        messages,
        {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      ));
    } catch (error) {
      logger.error('Error fetching sent messages', { error, characterId: req.character?.characterId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei messaggi inviati',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/ongame-threads/:id
   * Get thread with messages
   *
   * Params:
   * - id: OnGameThread ID
   */
  static async getThread(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const threadId = req.params.id as string;
      const { OnGameThread } = await import('@database/models/OnGameThread');

      // Get thread
      const thread = await OnGameThread.findById(threadId)
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

      // Get thread messages (ordered by sentAt)
      const messages = await OnGameMessage.find({
        onGameThreadId: new mongoose.Types.ObjectId(threadId)
      })
        .populate('senderId', 'name surname avatar')
        .sort({ sentAt: 1 })
        .lean();

      // Reset unread count for this character
      await OnGameThreadService.resetUnreadCount(
        new mongoose.Types.ObjectId(threadId),
        new mongoose.Types.ObjectId(req.character.characterId)
      );

      res.status(200).json(successResponse({
        thread,
        messages
      }));
    } catch (error) {
      logger.error('Error fetching thread', { error, threadId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento del thread',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * DELETE /game/messages/:id
   * Soft delete message
   *
   * Permissions:
   * - Sender can delete if sentAt < 5 minutes ago OR isMaster
   * - Recipient can always delete (their view)
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
      const message = await OnGameMessage.findById(messageId);

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND'
        ));
        return;
      }

      const characterId = req.character.characterId;
      const isSender = message.senderId.toString() === characterId;
      const isRecipient = message.recipientId.toString() === characterId;

      if (!isSender && !isRecipient) {
        res.status(403).json(errorResponse(
          'Non sei il mittente o il destinatario di questo messaggio',
          'FORBIDDEN'
        ));
        return;
      }

      // Sender-specific validation: 5-minute time limit (unless master)
      if (isSender) {
        const now = Date.now();
        const sentAt = message.sentAt.getTime();
        const fiveMinutes = 5 * 60 * 1000;
        const isMaster = req.character.gameplayRoles?.includes('master') || req.character.isGestore;

        if (now - sentAt > fiveMinutes && !isMaster) {
          res.status(403).json(errorResponse(
            'Non puoi eliminare messaggi inviati da più di 5 minuti',
            'DELETE_TIME_EXPIRED'
          ));
          return;
        }
      }

      // Soft delete via MessageService
      await MessageService.deleteMessage(
        new mongoose.Types.ObjectId(messageId),
        new mongoose.Types.ObjectId(characterId),
        'ongame'
      );

      res.status(200).json(successResponse(
        undefined,
        'Messaggio eliminato con successo'
      ));
    } catch (error) {
      logger.error('Error deleting message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse(
        'Errore durante l\'eliminazione del messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/ongame-messages/outbox
   * List sent messages (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 25)
   */
  static async getOutbox(req: Request, res: Response): Promise<void> {
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
      const skip = (page - 1) * limit;

      // Query: sent messages (NOT deleted by sender)
      const query = {
        senderId: new mongoose.Types.ObjectId(req.character.characterId),
        'deletedBy.sender': { $exists: false }
      };

      const total = await OnGameMessage.countDocuments(query);
      const messages = await OnGameMessage.find(query)
        .populate('recipientId', 'name surname avatar')
        .populate('onGameThreadId')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(total / limit);

      res.status(200).json(listResponse(
        messages,
        {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      ));
    } catch (error) {
      logger.error('Error fetching outbox', { error, characterId: req.character?.characterId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei messaggi inviati',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * PATCH /game/ongame-messages/:id/read
   * Mark message as read (resets unread count on thread)
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
      const message = await OnGameMessage.findById(messageId);

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND'
        ));
        return;
      }

      // Only recipient can mark as read
      if (message.recipientId.toString() !== req.character.characterId) {
        res.status(403).json(errorResponse(
          'Non sei il destinatario di questo messaggio',
          'FORBIDDEN'
        ));
        return;
      }

      // Reset unread count on thread
      if (message.onGameThreadId) {
        await OnGameThreadService.resetUnreadCount(
          message.onGameThreadId,
          new mongoose.Types.ObjectId(req.character.characterId)
        );
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
   * GET /game/ongame-messages/types
   * Get available message types from SystemConfiguration
   */
  static async getMessageTypes(req: Request, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(400).json(errorResponse(
          'Selezione del personaggio richiesta',
          'CHARACTER_REQUIRED'
        ));
        return;
      }

      const { SystemConfiguration } = await import('@database/models/SystemConfiguration');

      // Fetch all postal message type configurations
      const configs = await SystemConfiguration.find({
        configKey: { $regex: /^postal_message_type_/ }
      });

      const messageTypes = configs.map(config => ({
        type: config.configKey.replace('postal_message_type_', ''),
        config: config.value
      }));

      res.status(200).json(successResponse(
        messageTypes,
        'Tipi di messaggio recuperati con successo'
      ));
    } catch (error) {
      logger.error('Error fetching message types', { error });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei tipi di messaggio',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/ongame-messages/threads
   * List all threads for character (paginated)
   *
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 25)
   */
  static async getThreads(req: Request, res: Response): Promise<void> {
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

      const threads = await OnGameThreadService.listThreads(
        new mongoose.Types.ObjectId(req.character.characterId),
        false, // includeDeleted = false
        page,
        limit
      );

      res.status(200).json(successResponse(
        {
          threads: threads.threads,
          pagination: {
            currentPage: threads.page,
            pageSize: limit,
            totalItems: threads.total,
            totalPages: threads.totalPages,
            hasNextPage: threads.page < threads.totalPages,
            hasPreviousPage: threads.page > 1
          }
        },
        'Thread recuperati con successo'
      ));
    } catch (error) {
      logger.error('Error fetching threads', { error, characterId: req.character?.characterId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei thread',
        'INTERNAL_ERROR'
      ));
    }
  }

  /**
   * GET /game/ongame-messages/thread/:partnerId
   * Get messages in thread with specific partner
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

      const partnerId = req.params.partnerId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      // Find or create thread with partner
      const { OnGameThread } = await import('@database/models/OnGameThread');
      const characterId = new mongoose.Types.ObjectId(req.character.characterId);
      const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

      const thread = await OnGameThread.findOne({
        participants: { $all: [characterId, partnerObjectId] }
      });

      if (!thread) {
        // No thread exists yet
        res.status(200).json(successResponse(
          {
            thread: null,
            messages: [],
            pagination: {
              currentPage: 1,
              pageSize: limit,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          'Nessun thread trovato'
        ));
        return;
      }

      // Get messages in thread
      const query = {
        onGameThreadId: thread._id,
        $or: [
          { 'deletedBy.sender': { $exists: false } },
          { 'deletedBy.recipient': { $exists: false } }
        ]
      };

      const total = await OnGameMessage.countDocuments(query);
      const messages = await OnGameMessage.find(query)
        .populate('senderId', 'name surname avatar')
        .sort({ sentAt: 1 }) // Chronological order
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(total / limit);

      // Reset unread count
      await OnGameThreadService.resetUnreadCount(thread._id, characterId);

      res.status(200).json(successResponse(
        {
          thread,
          messages,
          pagination: {
            currentPage: page,
            pageSize: limit,
            totalItems: total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        },
        'Messaggi recuperati con successo'
      ));
    } catch (error) {
      logger.error('Error fetching thread messages', { error, partnerId: req.params.partnerId });
      res.status(500).json(errorResponse(
        'Errore durante il caricamento dei messaggi',
        'INTERNAL_ERROR'
      ));
    }
  }
}