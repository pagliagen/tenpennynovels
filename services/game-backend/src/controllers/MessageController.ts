import { Request, Response } from 'express';
import { Character, OnGameMessage, OffGameChatMessage, Location, VictorianMessageType, LocationMessageType } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';

export class MessageController {
  /**
   * POST /game/messages/send
   * Send in-game message (postal system)
   */
  static async sendInGameMessage(req: Request, res: Response): Promise<void> {
    try {
      const { recipients, messageType, subject, content, isPrivate } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      // Get sender character
      const sender = await (Character.findById(characterId) as any);
      if (!sender) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio mittente non trovato',
          code: 'SENDER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Validate message type
      const validTypes: MessageType[] = ['letter', 'telegram', 'postcard', 'invitation', 'official_document'];
      if (!validTypes.includes(messageType)) {
        const response: ApiResponse = {
          success: false,
          error: 'Tipo di messaggio non valido',
          code: 'INVALID_MESSAGE_TYPE',
          details: { validTypes },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate recipients exist
      const recipientCharacters = await (Character.find({
        _id: { $in: recipients },
        status: 'APPROVED'
      }) as any);

      if (recipientCharacters.length !== recipients.length) {
        const response: ApiResponse = {
          success: false,
          error: 'Uno o più destinatari non trovati',
          code: 'RECIPIENTS_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Calculate delivery delay based on message type
      const deliveryDelays = {
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
      for (const recipientId of recipients as any[]) {
        const message = new InGameMessage({
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

      // TODO: Publish Redis event for delivery scheduling
      // redis.publish('messages:in_game_sent', { 
      //   messageIds: messages.map(m => m.id), 
      //   deliveryTime: deliveredAt 
      // });

      logger.info('In-game message sent', {
        senderId: characterId,
        recipientCount: recipients.length,
        messageType,
        deliveryTime: deliveredAt
      });

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Send in-game message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile inviare il messaggio',
        code: 'SEND_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
      const messages = await (InGameMessage.find({
        recipientId: characterId,
        status: { $in: ['delivered', 'read'] },
        deliveredAt: { $lte: new Date() }
      })
      .sort({ deliveredAt: -1 })
      .skip(skip)
      .limit(limit) as any);

      const totalMessages = await (InGameMessage.countDocuments({
        recipientId: characterId,
        status: { $in: ['delivered', 'read'] },
        deliveredAt: { $lte: new Date() }
      }) as any);

      const response: ApiResponse = {
        success: true,
        data: {
          messages: messages.map((msg: any) => ({
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
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalMessages / limit),
            totalMessages,
            hasMore: skip + messages.length < totalMessages
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get inbox error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la casella di posta',
        code: 'GET_INBOX_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const messages = await (InGameMessage.find({
        senderId: characterId
      })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit) as any);

      const totalMessages = await (InGameMessage.countDocuments({
        senderId: characterId
      }) as any);

      const response: ApiResponse = {
        success: true,
        data: {
          messages: messages.map((msg: any) => ({
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
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalMessages / limit),
            totalMessages,
            hasMore: skip + messages.length < totalMessages
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get sent messages error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i messaggi inviati',
        code: 'GET_SENT_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/messages/:messageId
   * Read specific message (marks as read)
   */
  static async readMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const characterId = req.character!.characterId;

      const message = await (InGameMessage.findOne({
        _id: messageId,
        $or: [
          { recipientId: characterId },
          { senderId: characterId }
        ]
      }) as any);

      if (!message) {
        const response: ApiResponse = {
          success: false,
          error: 'Messaggio non trovato',
          code: 'MESSAGE_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if message is delivered (for recipients)
      if (message.recipientId === characterId && message.deliveredAt > new Date()) {
        const response: ApiResponse = {
          success: false,
          error: 'Messaggio non ancora consegnato',
          code: 'MESSAGE_NOT_DELIVERED',
          details: {
            estimatedDelivery: message.deliveredAt
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Mark as read if recipient
      if (message.recipientId === characterId && message.status === 'delivered') {
        message.status = 'read';
        message.readAt = new Date();
        await message.save();
      }

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Read message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile leggere il messaggio',
        code: 'READ_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }


  /**
   * DELETE /game/messages/:messageId
   * Delete message (sender only, within time limit)
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const characterId = req.character!.characterId;
      const userId = req.user!.userId;

      // Try to find in both in-game and OOC messages
      const inGameMessage = await (InGameMessage.findOne({
        _id: messageId,
        senderId: characterId
      }) as any);

      const oocMessage = await (OffGameMessage.findOne({
        _id: messageId,
        senderId: userId
      }) as any);

      const message = inGameMessage || oocMessage;

      if (!message) {
        const response: ApiResponse = {
          success: false,
          error: 'Messaggio non trovato o non autorizzato',
          code: 'MESSAGE_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Il messaggio non può essere eliminato',
          code: 'MESSAGE_NOT_DELETABLE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      await message.deleteOne();

      logger.info('Message deleted', {
        messageId,
        messageType: inGameMessage ? 'in_game' : 'ooc',
        deletedBy: userId
      });

      const response: ApiResponse = {
        success: true,
        message: 'Message deleted successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Delete message error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eliminare il messaggio',
        code: 'DELETE_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        InGameMessage.countDocuments({
          recipientId: characterId,
          status: 'delivered',
          deliveredAt: { $lte: new Date() }
        }),
        OffGameMessage.countDocuments({
          $or: [
            { isPrivate: false },
            { targetUserId: userId, isPrivate: true }
          ],
          sentAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
      ]) as any[];

      const response: ApiResponse = {
        success: true,
        data: {
          unreadCounts: {
            inGame: inGameUnread,
            ooc: oocUnread,
            total: inGameUnread + oocUnread
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get unread count error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il conteggio dei non letti',
        code: 'GET_UNREAD_COUNT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}