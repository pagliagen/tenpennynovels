import { Request, Response } from 'express';
import { Character, OnGameMessage, OffGameChatMessage, Location } from '@database/models';
import { VictorianMessageType, LocationMessageType } from '@shared/types/messaging';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';
import { redis } from '@config/runtime/redis';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId , deleteResponse} from '@shared/utils/apiResponse';


// Type aliases for message properties
type MessageType = 'letter' | 'telegram' | 'postcard' | 'invitation' | 'official_document';
type MessageStatus = 'pending' | 'delivered' | 'failed' | 'read';

export class MessageController {
  /**
   * POST /game/messages/send
   * Send in-game message (postal system)
   */
  static async sendOnGameMessage(req: Request, res: Response): Promise<void> {
    try {
      const { recipients, messageType, subject, content, isPrivate } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      // Get sender character
      const sender = await Character.findById(characterId);
      if (!sender) {
        res.status(404).json(errorResponse(
          'Personaggio mittente non trovato',
          'SENDER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validate message type
      const validTypes: MessageType[] = ['letter', 'telegram', 'postcard', 'invitation', 'official_document'];
      if (!validTypes.includes(messageType)) {
        res.status(400).json(errorResponse(
          'Tipo di messaggio non valido',
          'INVALID_MESSAGE_TYPE',
          { validTypes },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate recipients exist
      const recipientCharacters = await Character.find({
        _id: { $in: recipients },
        status: 'APPROVED'
      });

      if (recipientCharacters.length !== recipients.length) {
        res.status(400).json(errorResponse(
          'Uno o più destinatari non trovati',
          'RECIPIENTS_NOT_FOUND',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Calculate delivery delay based on message type
      const deliveryDelays: Record<string, number> = {
        letter: 4 * 60 * 60 * 1000, // 4 hours
        telegram: 30 * 60 * 1000,   // 30 minutes
        postcard: 6 * 60 * 60 * 1000, // 6 hours
        invitation: 2 * 60 * 60 * 1000, // 2 hours
        official_document: 1 * 60 * 60 * 1000 // 1 hour
      };

      const deliveryDelay = deliveryDelays[messageType] || deliveryDelays.letter;
      const deliveredAt = new Date(Date.now() + deliveryDelay);

      // Create message for each recipient
      const messages = [];
      for (const recipientId of recipients) {
        const message = new OnGameMessage({
          senderId: characterId,
          senderName: characterName,
          recipientId,
          messageType,
          subject,
          content,
          isPrivate: isPrivate || false,
          status: 'sent' as MessageStatus,
          sentAt: new Date(),
          deliveredAt,
          metadata: {
            senderLocation: sender.currentLocation,
            postmarkLocation: sender.currentLocation
          }
        });

        await message.save();
        messages.push(message);
      }

      // Publish Redis event for delivery scheduling
      await redis.publish('messages:in_game', JSON.stringify({
        type: 'message_sent',
        messageIds: messages.map(m => m._id.toString()),
        senderId: characterId.toString(),
        deliveryTime: deliveredAt,
        timestamp: new Date().toISOString()
      }));

      logger.info('In-game message sent', {
        senderId: characterId,
        recipientCount: recipients.length,
        messageType,
        deliveryTime: deliveredAt
      });

      res.status(201).json(createResponse(
        {
          messages: messages.map((msg: any) => ({
            id: msg.id,
            recipientId: msg.recipientId,
            messageType: msg.messageType,
            subject: msg.subject,
            status: msg.status,
            sentAt: msg.sentAt,
            deliveredAt: msg.deliveredAt
          })),
          deliveryInfo: {
            estimatedDelivery: deliveredAt,
            deliveryMethod: messageType
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Send in-game message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile inviare il messaggio',
        'SEND_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/messages/inbox
   * Get character's inbox (delivered in-game messages)
   */
  static async getInbox(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get delivered messages
      const messages = await OnGameMessage.find({
        recipientId: characterId,
        status: { $in: ['delivered', 'read'] },
        deliveredAt: { $lte: new Date() }
      })
      .sort({ deliveredAt: -1 })
      .skip(skip)
      .limit(limit);

      const totalMessages = await OnGameMessage.countDocuments({
        recipientId: characterId,
        status: { $in: ['delivered', 'read'] },
        deliveredAt: { $lte: new Date() }
      });

      res.json(listResponse(
        messages.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          messageType: msg.messageType,
          subject: msg.subject,
          status: msg.status,
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          readAt: msg.readAt,
          isPrivate: msg.isPrivate
        })),
        {
          currentPage: page,
          pageSize: limit,
          totalItems: totalMessages,
          totalPages: Math.ceil(totalMessages / limit),
          hasNextPage: skip + messages.length < totalMessages,
          hasPreviousPage: page > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get inbox error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la casella di posta',
        'GET_INBOX_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/messages/sent
   * Get character's sent messages
   */
  static async getSentMessages(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const messages = await OnGameMessage.find({
        senderId: characterId
      })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit);

      const totalMessages = await OnGameMessage.countDocuments({
        senderId: characterId
      });

      res.json(listResponse(
        messages.map((msg: any) => ({
          id: msg.id,
          recipientId: msg.recipientId,
          messageType: msg.messageType,
          subject: msg.subject,
          status: msg.status,
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          readAt: msg.readAt,
          isPrivate: msg.isPrivate
        })),
        {
          currentPage: page,
          pageSize: limit,
          totalItems: totalMessages,
          totalPages: Math.ceil(totalMessages / limit),
          hasNextPage: skip + messages.length < totalMessages,
          hasPreviousPage: page > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get sent messages error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i messaggi inviati',
        'GET_SENT_MESSAGES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/messages/:messageId
   * Read specific message (marks as read)
   */
  static async readMessage(req: Request<{ messageId: string }>, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const characterId = req.character!.characterId;

      const message = await OnGameMessage.findOne({
        _id: messageId,
        $or: [
          { recipientId: characterId },
          { senderId: characterId }
        ]
      });

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if message is delivered (for recipients)
      if (message.recipientId === characterId && message.deliveredAt > new Date()) {
        res.status(400).json(errorResponse(
          'Messaggio non ancora consegnato',
          'MESSAGE_NOT_DELIVERED',
          {
            estimatedDelivery: message.deliveredAt
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Mark as read if recipient
      if (message.recipientId === characterId && message.status === 'delivered') {
        message.status = 'read';
        message.readAt = new Date();
        await message.save();
      }

      res.json(successResponse(
        {
          message: {
            id: message.id,
            senderId: message.senderId,
            senderName: message.senderName,
            recipientId: message.recipientId,
            messageType: message.messageType,
            subject: message.subject,
            content: message.content,
            isPrivate: message.isPrivate,
            status: message.status,
            sentAt: message.sentAt,
            deliveredAt: message.deliveredAt,
            readAt: message.readAt,
            metadata: message.metadata
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Read message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile leggere il messaggio',
        'READ_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }


  /**
   * DELETE /game/messages/:messageId
   * Delete message (sender only, within time limit)
   */
  static async deleteMessage(req: Request<{ messageId: string }>, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const characterId = req.character!.characterId;
      const userId = req.user!.userId;

      // Try to find in both in-game and OOC messages
      const inGameMessage = await OnGameMessage.findOne({
        _id: messageId,
        senderId: characterId
      });

      const oocMessage = await OffGameChatMessage.findOne({
        _id: messageId,
        senderId: userId
      });

      const message = inGameMessage || oocMessage;

      if (!message) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato o non autorizzato',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if message can be deleted (within 5 minutes for OOC, before delivery for in-game)
      const now = new Date();
      let canDelete = false;

      if (inGameMessage) {
        // In-game messages can be deleted before delivery
        canDelete = inGameMessage.deliveredAt > now;
      } else if (oocMessage) {
        // OOC messages can be deleted within 5 minutes
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        canDelete = oocMessage.sentAt > fiveMinutesAgo;
      }

      if (!canDelete) {
        res.status(400).json(errorResponse(
          'Il messaggio non può essere eliminato',
          'MESSAGE_NOT_DELETABLE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      await message.deleteOne();

      logger.info('Message deleted', {
        messageId,
        messageType: inGameMessage ? 'in_game' : 'ooc',
        deletedBy: userId
      });

      res.json(deleteResponse(
        'Message deleted successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Delete message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eliminare il messaggio',
        'DELETE_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/messages/unread-count
   * Get count of unread messages
   */
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const userId = req.user!.userId;

      const [inGameUnread, oocUnread] = await Promise.all([
        OnGameMessage.countDocuments({
          recipientId: characterId,
          status: 'delivered',
          deliveredAt: { $lte: new Date() }
        }),
        OffGameChatMessage.countDocuments({
          $or: [
            { isPrivate: false },
            { targetUserId: userId, isPrivate: true }
          ],
          sentAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
      ]);

      res.json(successResponse(
        {
          unreadCounts: {
            inGame: inGameUnread,
            ooc: oocUnread,
            total: inGameUnread + oocUnread
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get unread count error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare il conteggio dei non letti',
        'GET_UNREAD_COUNT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}