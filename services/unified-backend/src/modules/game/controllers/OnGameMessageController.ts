import { Request, Response } from 'express';
import { OnGameMessage, OnGameMessageView, Character, CharacterWallet, db } from '@database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { postalSystem } from '../utils/postalSystem';
import { successResponse, errorResponse, listResponse, createResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class OnGameMessageController {
  /**
   * POST /game/ongame-messages
   * Send new message through Victorian postal system
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageType, to, subject, content, deliveryTarget, isExpress } = req.body;
      const characterId = req.character!.characterId;
      const characterRoles = req.character!.gameplayRoles;

      logger.info('🔍 SendMessage - Start', {
        messageType,
        to: to?.length || 0,
        subject,
        contentLength: content?.length || 0,
        deliveryTarget,
        isExpress,
        characterId
      });

      // Defense in depth: Verify sender is APPROVED (middleware already checks, but explicit validation for security)
      const senderCharacter = await Character.findById(characterId);
      if (!senderCharacter || senderCharacter.status !== 'APPROVED') {
        logger.warn('SECURITY: DRAFT character attempted to send OnGame message', {
          characterId,
          status: senderCharacter?.status,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono inviare messaggi ONGAME',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Validation
      if (!messageType || !to || !Array.isArray(to) || to.length === 0) {
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            ...((!messageType) && { messageType: 'Tipo di messaggio richiesto' }),
            ...((!to || !Array.isArray(to) || to.length === 0) && { recipients: 'Almeno un destinatario è richiesto' })
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!subject || subject.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            subject: 'Oggetto del messaggio richiesto'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!content || content.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            content: 'Contenuto del messaggio richiesto'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate message type and permissions (without recipients count for now)
      const validation = postalSystem.validateMessage(messageType, content, characterRoles || []);
      if (!validation.valid) {
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            message: validation.error || 'Errore di validazione del messaggio'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Calculate postage and delivery time
      const postageRequired = postalSystem.calculatePostage(messageType, isExpress || false);
      const deliveryTime = postalSystem.calculateDeliveryTime(messageType, isExpress || false);

      // Check sender's wallet for postage
      if (postageRequired > 0) {
        const wallet = await CharacterWallet.findOne({ characterId });
        if (!wallet || (wallet.cash + wallet.deposit) < postageRequired) {
          const available = wallet ? (wallet.cash + wallet.deposit) : 0;
          res.status(400).json(errorResponse(
            'Validation failed',
            'VALIDATION_ERROR',
            {
              postage: `Fondi insufficienti. Richiesti: ${postageRequired} pence, disponibili: ${available} pence`
            },
            400,
            getRequestId(req)
          ));
          return;
        }

        // Deduct postage from cash first, then deposit
        let remaining = postageRequired;
        if (wallet.cash >= remaining) {
          wallet.cash -= remaining;
        } else {
          remaining -= wallet.cash;
          wallet.cash = 0;
          wallet.deposit -= remaining;
        }
        await wallet.save();
      }

      // Verify recipients exist and are APPROVED
      const recipientIds = to.map(id => new mongoose.Types.ObjectId(id));
      const recipients = await (Character.find({
        _id: { $in: recipientIds },
        status: 'APPROVED' // Only APPROVED characters can receive OnGame messages
      }) as any);

      if (recipients.length !== recipientIds.length) {
        // Find which recipients are invalid for detailed error
        const validIds = recipients.map((r: any) => r._id.toString());
        const invalidIds = recipientIds.filter(id => !validIds.includes(id));
        
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            recipients: `Destinatari non validi o non esistenti: ${invalidIds.length > 0 ? invalidIds.join(', ') : 'alcuni destinatari non sono stati trovati'}`
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate recipient count after we have recipientIds
      const recipientValidation = postalSystem.validateMessage(messageType, content, characterRoles || [], to);
      if (!recipientValidation.valid) {
        res.status(400).json(errorResponse(
          'Validation failed',
          'VALIDATION_ERROR',
          {
            recipients: recipientValidation.error || 'Errore di validazione dei destinatari'
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create main message record
      const message = new OnGameMessage({
        messageType,
        from: new mongoose.Types.ObjectId(characterId),
        to: recipientIds,
        subject: subject.trim(),
        content: content.trim(),
        sentAt: new Date(),
        scheduledDelivery: deliveryTime,
        deliveryTarget: {
          type: deliveryTarget?.type || 'character',
          requiresKnownResidence: postalSystem.requiresResidenceKnowledge(messageType)
        },
        sentFromLocation: new mongoose.Types.ObjectId('673f8b2d4a5e6c7d8e9f0123'), // TODO: Get from character current location
        postageCharged: postageRequired,
        isExpress: isExpress || false,
        sealed: postalSystem.getMessageType(messageType)?.requiresSealing || false
      });

      await message.save();

      // Create message views (Gmail-style)
      const messageViews = [];

      // Outbox view for sender
      messageViews.push({
        messageId: message._id,
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'outbox',
        isRead: true, // Sender has "read" their own message
        readAt: new Date(),
        deliveryStatus: deliveryTime ? 'sent' : 'delivered'
      });

      // Inbox views for recipients
      for (const recipientId of recipientIds) {
        messageViews.push({
          messageId: message._id,
          characterId: recipientId,
          viewType: 'inbox',
          isRead: false,
          deliveryStatus: deliveryTime ? 'in_transit' : 'delivered',
          deliveredAt: deliveryTime || new Date()
        });
      }

      await OnGameMessageView.insertMany(messageViews);

      // For realtime delivery, trigger WebSocket notification immediately
      if (!deliveryTime || deliveryTime <= new Date()) {
        const io = req.app.get('io');
        if (io) {
          const senderCharacter = await (Character.findById(characterId) as any);
          
          for (const recipient of recipients) {
            const notificationData = {
              messageId: message._id.toString(),
              fromCharacterId: characterId,
              fromCharacterName: senderCharacter?.name || 'Unknown',
              toCharacterIds: [recipient._id.toString()],
              messageType,
              subject: subject.trim(),
              content: content.trim(),
              sentAt: new Date(),
              deliveredAt: new Date(),
              icon: postalSystem.getMessageType(messageType)?.icon || '📬',
              postageCharged: postageRequired
            };

            const recipientRoom = `character_${recipient._id}`;
            io.to(recipientRoom).emit('ongame:message_delivered', notificationData);
          }
          
          // Also send notification to sender to update their thread view
          const senderNotificationData = {
            messageId: message._id.toString(),
            fromCharacterId: characterId,
            fromCharacterName: senderCharacter?.name || 'Unknown',
            toCharacterIds: recipients.map((r: any) => r._id.toString()),
            messageType,
            subject: subject.trim(),
            content: content.trim(),
            sentAt: new Date(),
            deliveredAt: new Date(),
            icon: postalSystem.getMessageType(messageType)?.icon || '📬',
            postageCharged: postageRequired
          };
          
          const senderRoom = `character_${characterId}`;
          io.to(senderRoom).emit('ongame:message_sent', senderNotificationData);
          
          logger.info('OnGame message delivered immediately via WebSocket', {
            messageId: message._id,
            messageType,
            recipientCount: recipients.length
          });
        }
      }

      logger.info('OnGame message sent successfully', {
        messageId: message._id,
        messageType,
        from: characterId,
        recipientCount: recipients.length,
        postageCharged: postageRequired,
        scheduledDelivery: deliveryTime
      });

      res.status(201).json(createResponse(
        {
          messageId: message._id,
          scheduledDelivery: deliveryTime,
          postageCharged: postageRequired,
          deliveryStatus: deliveryTime ? 'sent' : 'delivered'
        },
        'Message sent successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Send OnGame message error:', error);

      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        {
          system: 'Errore interno durante l\'invio del messaggio. Riprova più tardi.'
        },
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/ongame-messages/inbox
   * Get character's inbox (received messages)
   */
  static async getInbox(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const folder = req.query.folder as string;
      const unreadOnly = req.query.unreadOnly === 'true';
      const skip = (page - 1) * limit;

      const query: any = {
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'inbox',
        isDeleted: false
      };

      if (folder) {
        query.customFolder = folder;
      }

      if (unreadOnly) {
        query.isRead = false;
      }

      const messageViews = await OnGameMessageView.find(query)
        .populate({
          path: 'messageId',
          populate: {
            path: 'from',
            select: 'name avatar'
          }
        })
        .sort({ 'createdAt': -1 })
        .skip(skip)
        .limit(limit);

      const totalCount = await OnGameMessageView.countDocuments(query);
      const unreadCount = await OnGameMessageView.countDocuments({
        ...query,
        isRead: false
      });

      const messages = messageViews.map(view => ({
        viewId: view._id,
        messageId: view.messageId._id,
        messageType: view.messageId.messageType,
        from: view.messageId.from,
        subject: view.messageId.subject,
        content: view.messageId.sealed && !view.isRead ? '[Sealed Message]' : view.messageId.content,
        sentAt: view.messageId.sentAt,
        deliveredAt: view.deliveredAt,
        isRead: view.isRead,
        readAt: view.readAt,
        isStarred: view.isStarred,
        customFolder: view.customFolder,
        deliveryStatus: view.deliveryStatus,
        icon: postalSystem.getMessageType(view.messageId.messageType)?.icon || '📬'
      }));

      res.json(successResponse(
        {
          messages,
          pagination: {
            page,
            limit,
            total: totalCount,
            hasMore: skip + messages.length < totalCount
          },
          unreadCount
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Get inbox error:', error);

      res.status(500).json(errorResponse(
        'Failed to get inbox',
        'GET_INBOX_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/ongame-messages/outbox
   * Get character's outbox (sent messages)
   */
  static async getOutbox(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const messageViews = await OnGameMessageView.find({
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'outbox',
        isDeleted: false
      })
      .populate({
        path: 'messageId',
        populate: {
          path: 'to',
          select: 'name avatar'
        }
      })
      .sort({ 'createdAt': -1 })
      .skip(skip)
      .limit(limit);

      const totalCount = await OnGameMessageView.countDocuments({
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'outbox',
        isDeleted: false
      });

      const messages = messageViews.map(view => ({
        viewId: view._id,
        messageId: view.messageId._id,
        messageType: view.messageId.messageType,
        to: view.messageId.to,
        subject: view.messageId.subject,
        content: view.messageId.content,
        sentAt: view.messageId.sentAt,
        scheduledDelivery: view.messageId.scheduledDelivery,
        deliveredAt: view.deliveredAt,
        isStarred: view.isStarred,
        deliveryStatus: view.deliveryStatus,
        deliveryAttempts: view.deliveryAttempts,
        deliveryError: view.deliveryError,
        postageCharged: view.messageId.postageCharged,
        icon: postalSystem.getMessageType(view.messageId.messageType)?.icon || '📬'
      }));

      res.json(listResponse(
        messages,
        {
          page,
          pageSize: limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: skip + messages.length < totalCount,
          hasPrev: page > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Get outbox error:', error);

      res.status(500).json(errorResponse(
        'Failed to get outbox',
        'GET_OUTBOX_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /game/ongame-messages/:id/read
   * Mark message as read and trigger read receipt
   */
  static async markAsRead(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const viewId = req.params.id;
      const characterId = req.character!.characterId;

      const messageView = await OnGameMessageView.findOne({
        _id: viewId,
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'inbox'
      }).populate('messageId');

      if (!messageView) {
        res.status(404).json(errorResponse(
          'Message not found',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (!messageView.isRead) {
        messageView.isRead = true;
        messageView.readAt = new Date();
        await messageView.save();

        // Send read receipt to sender via WebSocket
        const io = req.app.get('io');
        if (io) {
          const reader = await (Character.findById(characterId) as any);
          const readReceiptData = {
            type: 'message_read_receipt',
            messageId: messageView.messageId._id.toString(),
            readBy: reader?.name || 'Unknown',
            readAt: messageView.readAt
          };

          const senderRoom = `character_${messageView.messageId.from}`;
          io.to(senderRoom).emit('ongame:message_read', readReceiptData);
        }

        logger.info('OnGame message marked as read', {
          viewId,
          messageId: messageView.messageId._id,
          characterId
        });
      }

      res.json(successResponse(
        undefined,
        'Message marked as read',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Mark as read error:', error);

      res.status(500).json(errorResponse(
        'Failed to mark message as read',
        'MARK_READ_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * DELETE /game/ongame-messages/:id
   * Soft delete message view (Gmail-style)
   */
  static async deleteMessage(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const viewId = req.params.id;
      const characterId = req.character!.characterId;

      const messageView = await OnGameMessageView.findOne({
        _id: viewId,
        characterId: new mongoose.Types.ObjectId(characterId)
      });

      if (!messageView) {
        res.status(404).json(errorResponse(
          'Message not found',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      messageView.isDeleted = true;
      await messageView.save();

      logger.info('OnGame message soft deleted', {
        viewId,
        characterId,
        viewType: messageView.viewType
      });

      res.json(deleteResponse(
        'Message deleted successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Delete message error:', error);

      res.status(500).json(errorResponse(
        'Failed to delete message',
        'DELETE_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/ongame-messages/threads
   * Get conversation threads for current character
   */
  static async getThreads(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get all messages where this character is sender or recipient
      const messages = await OnGameMessage.find({
        $or: [
          { from: new mongoose.Types.ObjectId(characterId) },
          { to: { $in: [new mongoose.Types.ObjectId(characterId)] } }
        ]
      })
      .populate('from', 'name avatar')
      .populate('to', 'name avatar')
      .sort({ sentAt: -1 });

      // Group messages by conversation partner
      const threadsMap = new Map();

      for (const message of messages) {
        // Determine the other participant(s) in the conversation
        const isSender = message.from._id.toString() === characterId;
        
        if (isSender) {
          // If we sent the message, create threads for each recipient
          for (const recipient of message.to) {
            const partnerId = recipient._id.toString();
            if (partnerId !== characterId) {
              const threadKey = partnerId;
              if (!threadsMap.has(threadKey)) {
                threadsMap.set(threadKey, {
                  partnerId,
                  partnerName: recipient.name,
                  partnerAvatar: recipient.avatar,
                  lastMessage: message,
                  lastMessageDate: message.sentAt,
                  unreadCount: 0 // We'll calculate this properly later
                });
              } else {
                const existing = threadsMap.get(threadKey);
                if (message.sentAt > existing.lastMessageDate) {
                  existing.lastMessage = message;
                  existing.lastMessageDate = message.sentAt;
                }
              }
            }
          }
        } else {
          // If we received the message, create thread with sender
          const partnerId = message.from._id.toString();
          const threadKey = partnerId;
          if (!threadsMap.has(threadKey)) {
            threadsMap.set(threadKey, {
              partnerId,
              partnerName: message.from.name,
              partnerAvatar: message.from.avatar,
              lastMessage: message,
              lastMessageDate: message.sentAt,
              unreadCount: 0 // We'll calculate this properly later
            });
          } else {
            const existing = threadsMap.get(threadKey);
            if (message.sentAt > existing.lastMessageDate) {
              existing.lastMessage = message;
              existing.lastMessageDate = message.sentAt;
            }
          }
        }
      }

      // Convert map to array and sort by last message date
      const threads = Array.from(threadsMap.values()).sort((a, b) => 
        new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
      );

      // Calculate unread counts
      for (const thread of threads) {
        const unreadCount = await OnGameMessageView.countDocuments({
          characterId: new mongoose.Types.ObjectId(characterId),
          viewType: 'inbox',
          isRead: false,
          'messageId.from': new mongoose.Types.ObjectId(thread.partnerId)
        });
        thread.unreadCount = unreadCount;
      }

      res.json(successResponse(
        {
          threads: threads.map(thread => ({
            partnerId: thread.partnerId,
            partnerName: thread.partnerName,
            partnerAvatar: thread.partnerAvatar,
            lastMessage: {
              id: thread.lastMessage._id,
              messageType: thread.lastMessage.messageType,
              subject: thread.lastMessage.subject,
              content: thread.lastMessage.content,
              sentAt: thread.lastMessage.sentAt,
              isSentByMe: thread.lastMessage.from._id.toString() === characterId,
              icon: postalSystem.getMessageType(thread.lastMessage.messageType)?.icon || '📬'
            },
            unreadCount: thread.unreadCount
          }))
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Get threads error:', error);

      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        {
          system: 'Errore interno durante il caricamento dei thread. Riprova più tardi.'
        },
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/ongame-messages/thread/:partnerId
   * Get full conversation with a specific partner
   */
  static async getThreadMessages(req: Request<{ partnerId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { partnerId } = req.params;

      // Get all messages between these two characters
      const messages = await OnGameMessage.find({
        $or: [
          // Messages from current character to partner
          { 
            from: new mongoose.Types.ObjectId(characterId),
            to: { $in: [new mongoose.Types.ObjectId(partnerId)] }
          },
          // Messages from partner to current character
          { 
            from: new mongoose.Types.ObjectId(partnerId),
            to: { $in: [new mongoose.Types.ObjectId(characterId)] }
          }
        ]
      })
      .populate('from', 'name avatar')
      .populate('to', 'name avatar')
      .sort({ sentAt: 1 }); // Chronological order for chat view

      // Get partner info
      const partner = await (Character.findById(partnerId).select('name avatar') as any);
      if (!partner) {
        res.status(404).json(errorResponse(
          'Partner not found',
          'PARTNER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Mark messages from partner as read
      await OnGameMessageView.updateMany({
        characterId: new mongoose.Types.ObjectId(characterId),
        viewType: 'inbox',
        'messageId.from': new mongoose.Types.ObjectId(partnerId),
        isRead: false
      }, {
        isRead: true,
        readAt: new Date()
      });

      res.json(successResponse(
        {
          partner: {
            id: partner._id,
            name: partner.name,
            avatar: partner.avatar
          },
          messages: messages.map(message => ({
            id: message._id,
            messageType: message.messageType,
            subject: message.subject,
            content: message.content,
            sentAt: message.sentAt,
            deliveredAt: message.deliveredAt,
            isSentByMe: message.from._id.toString() === characterId,
            icon: postalSystem.getMessageType(message.messageType)?.icon || '📬',
            postageCharged: message.postageCharged || 0
          }))
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Get thread messages error:', error);

      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        {
          system: 'Errore interno durante il caricamento della conversazione. Riprova più tardi.'
        },
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/ongame-messages/types
   * Get available message types for character
   */
  static async getMessageTypes(req: Request, res: Response): Promise<void> {
    try {
      const characterRoles = req.character!.gameplayRoles;
      const availableTypes = postalSystem.getAvailableMessageTypes(characterRoles || []);

      res.json(successResponse(
        availableTypes,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Get message types error:', error);

      res.status(500).json(errorResponse(
        'Failed to get message types',
        'GET_MESSAGE_TYPES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}