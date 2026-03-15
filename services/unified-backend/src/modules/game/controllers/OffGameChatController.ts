import { Request, Response } from 'express';
import { OffGameChat, OffGameChatMessage, OffGameChatParticipant, Character, db } from '@database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';


// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class OffGameChatController {
  /**
   * POST /game/offgame-chats
   * Create new chat (direct or group)
   */
  static async createChat(req: Request, res: Response): Promise<void> {
    try {
      const { type, name, participants } = req.body;
      const characterId = req.character!.characterId;

      logger.info('🔍 CreateChat - Start', {
        type,
        name,
        participants: participants?.length || 0,
        characterId,
        requestBody: req.body
      });

      // Validation
      if (!type || !['direct', 'group'].includes(type)) {
        res.status(400).json(errorResponse(
          'Invalid chat type. Must be "direct" or "group"',
          'INVALID_CHAT_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (type === 'group' && (!name || name.trim().length === 0)) {
        res.status(400).json(errorResponse(
          'Group name is required for group chats',
          'GROUP_NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!participants || !Array.isArray(participants) || participants.length === 0) {
        res.status(400).json(errorResponse(
          'At least one participant is required',
          'PARTICIPANTS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Group size limit
      if (type === 'group' && participants.length > 5) {
        res.status(400).json(errorResponse(
          'Group chats are limited to 5 participants maximum',
          'GROUP_SIZE_LIMIT_EXCEEDED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Direct chat can only have 1 other participant
      if (type === 'direct' && participants.length !== 1) {
        res.status(400).json(errorResponse(
          'Direct chats must have exactly one other participant',
          'INVALID_DIRECT_CHAT_SIZE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Convert string IDs to ObjectIds and verify all participants exist
      const currentCharacterObjectId = new mongoose.Types.ObjectId(characterId);
      const participantIds = participants.map(id => new mongoose.Types.ObjectId(id));
      const allParticipants = [...participantIds, currentCharacterObjectId];

      // First fetch initiator to check status
      const initiator = await Character.findById(characterId);
      if (!initiator) {
        res.status(404).json(errorResponse(
          'Personaggio iniziatore non trovato',
          'INITIATOR_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // CUSTOM LOGIC: DRAFT characters can only chat with APPROVED characters
      if (initiator.playerStatus === 'draft') {
        const otherParticipants = await Character.find({
          _id: { $in: participantIds }
        });

        const nonApprovedParticipants = otherParticipants.filter(p => p.playerStatus !== 'approved');

        if (nonApprovedParticipants.length > 0) {
          logger.warn('SECURITY: DRAFT character attempted to chat with non-APPROVED', {
            initiatorId: characterId,
            initiatorPlayerStatus: initiator.playerStatus,
            nonApprovedParticipants: nonApprovedParticipants.map(p => ({
              id: p._id,
              playerStatus: p.playerStatus
            })),
            userId: req.user?.userId
          });
          res.status(403).json(errorResponse(
            'I personaggi DRAFT possono chattare solo con personaggi APPROVATI',
            'DRAFT_CHAT_RESTRICTION',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      // Now fetch all participants for final validation
      const characters = await Character.find({
        _id: { $in: allParticipants },
        status: { $in: ['draft', 'PENDING_APPROVAL', 'APPROVED'] }
      });

      if (characters.length !== allParticipants.length) {
        res.status(400).json(errorResponse(
          'One or more participants are invalid',
          'INVALID_PARTICIPANTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if direct chat already exists
      if (type === 'direct') {
        const existingChat = await OffGameChat.findOne({
          type: 'direct',
          participants: { $all: allParticipants, $size: 2 },
          isActive: true
        });

        if (existingChat) {
          res.json(successResponse(
            existingChat.toJSON(),
            'Direct chat already exists',
            getRequestId(req)
          ));
          return;
        }
      }

      // Create new chat
      logger.info('🔍 CreateChat - About to create chat model', {
        type,
        name: type === 'group' ? name.trim() : undefined,
        participantsCount: allParticipants.length,
        allParticipants: allParticipants.map(p => p.toString()),
        adminsCount: type === 'group' ? 1 : 0,
        createdBy: currentCharacterObjectId.toString()
      });

      const chatData = {
        type,
        name: type === 'group' ? name.trim() : undefined,
        participants: allParticipants,
        admins: type === 'group' ? [currentCharacterObjectId] : [],
        createdBy: currentCharacterObjectId,
        lastActivity: new Date()
      };

      logger.info('🔍 CreateChat - Chat data structure:', chatData);

      const chat = new OffGameChat(chatData);

      logger.info('🔍 CreateChat - Chat model created, about to save', {
        chatId: chat._id?.toString(),
        chatType: chat.type,
        chatParticipants: chat.participants?.length || 0
      });

      await chat.save();

      logger.info('✅ CreateChat - Chat saved successfully', {
        chatId: chat._id.toString()
      });

      // Create participant records
      const participantRecords = allParticipants.map(participantId => ({
        chatId: chat._id,
        characterId: participantId,
        role: participantId.equals(currentCharacterObjectId) ? 'owner' : 'member',
        joinedAt: new Date()
      }));

      await OffGameChatParticipant.insertMany(participantRecords);

      // If group, create system message
      if (type === 'group') {
        const creator = characters.find((c: any) => c._id.equals(currentCharacterObjectId));
        const systemMessage = new OffGameChatMessage({
          chatId: chat._id,
          senderId: currentCharacterObjectId,
          content: `${creator?.name || 'Unknown'} ha creato il gruppo "${name}"`,
          messageType: 'system',
          sentAt: new Date()
        });

        await systemMessage.save();
        chat.lastMessage = systemMessage._id;
        await chat.save();
      }

      logger.info('OffGame chat created', {
        chatId: chat._id,
        type,
        createdBy: currentCharacterObjectId,
        participantCount: allParticipants.length
      });

      res.status(201).json(createResponse(
        chat.toJSON(),
        'Chat created successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Create chat error:', error);

      res.status(500).json(errorResponse(
        'Failed to create chat',
        'CREATE_CHAT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/offgame-chats
   * List user's chats
   */
  static async getChats(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Convert to ObjectId explicitly and use direct query
      const characterObjectId = new mongoose.Types.ObjectId(characterId);
      
      // Get chats where character is participant - raw query approach
      const chats = await OffGameChat.find({
        participants: characterObjectId,
        isActive: true
      })
      .populate('participants', 'name avatar')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit);

      // For each chat, get unread count
      const chatData = await Promise.all(chats.map(async (chat) => {
        const participant = await OffGameChatParticipant.findOne({
          chatId: chat._id,
          characterId,
          isActive: true
        });

        let unreadCount = 0;
        if (participant?.lastSeenMessageId) {
          unreadCount = await OffGameChatMessage.countDocuments({
            chatId: chat._id,
            _id: { $gt: participant.lastSeenMessageId },
            senderId: { $ne: characterId }, // Exclude own messages
            deletedAt: { $exists: false }
          });
        } else {
          unreadCount = await OffGameChatMessage.countDocuments({
            chatId: chat._id,
            senderId: { $ne: characterId }, // Exclude own messages
            deletedAt: { $exists: false }
          });
        }

        return {
          ...chat.toJSON(),
          unreadCount,
          isMuted: participant?.isMuted || false
        };
      }));

      res.json(listResponse(
        chatData,
        {
          page,
          pageSize: limit,
          total: chatData.length,
          totalPages: Math.ceil(chatData.length / limit),
          hasNext: chatData.length === limit,
          hasPrev: page > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Get chats error:', error);

      res.status(500).json(errorResponse(
        'Failed to get chats',
        'GET_CHATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/offgame-chats/:id/messages
   * Get chat messages
   */
  static async getChatMessages(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      // Verify chat exists and user is participant
      const chat = await OffGameChat.findOne({
        _id: chatId,
        participants: characterId,
        isActive: true
      });

      if (!chat) {
        res.status(404).json(errorResponse(
          'Chat not found or access denied',
          'CHAT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get messages (excluding deleted ones)
      const messages = await OffGameChatMessage.find({
        chatId: chatId,
        deletedAt: { $exists: false }
      })
      .populate('senderId', 'name avatar')
      .populate('replyTo')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit);

      // Update participant's last seen
      await OffGameChatParticipant.findOneAndUpdate(
        { chatId, characterId },
        {
          lastSeenAt: new Date(),
          lastSeenMessageId: messages[0]?._id
        }
      );

      // Emit WebSocket event about read receipt to all participants
      const io = req.app.get('io');
      if (io && messages[0]) {
        const participants = await OffGameChatParticipant.find({
          chatId,
          isActive: true
        }).select('characterId');

        for (const participant of participants) {
          if (participant.characterId.toString() !== characterId) {
            io.to(`character_${participant.characterId}`).emit('offgame_message_read', {
              chatId,
              characterId,
              characterName: req.character!.characterName,
              lastReadMessageId: messages[0]._id.toString(),
              readAt: new Date().toISOString()
            });
          }
        }
      }

      res.json(successResponse(
        {
          chatId,
          messages: messages.reverse(), // Reverse to show oldest first
          pagination: {
            page,
            limit,
            hasMore: messages.length === limit
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Get chat messages error:', error);

      res.status(500).json(errorResponse(
        'Failed to get chat messages',
        'GET_CHAT_MESSAGES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/offgame-chats/:id/messages
   * Send message to chat
   */
  static async sendMessage(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const { content, replyTo } = req.body;

      // Validation
      if (!content || content.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Message content is required',
          'MESSAGE_CONTENT_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (content.length > 2000) {
        res.status(400).json(errorResponse(
          'Message too long (max 2000 characters)',
          'MESSAGE_TOO_LONG',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Verify chat exists and user is participant
      const chat = await OffGameChat.findOne({
        _id: chatId,
        participants: characterId,
        isActive: true
      });

      if (!chat) {
        res.status(404).json(errorResponse(
          'Chat not found or access denied',
          'CHAT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if user is muted
      const participant = await OffGameChatParticipant.findOne({
        chatId,
        characterId,
        isActive: true
      });

      if (participant?.isMuted) {
        res.status(403).json(errorResponse(
          `You are muted until ${participant.mutedUntil?.toISOString()}`,
          'USER_MUTED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Defense in depth: Verify sender character status (DRAFT restriction)
      const { Character } = await import('@database/models');
      const senderCharacter = await Character.findById(characterId);

      if (!senderCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio mittente non trovato',
          'SENDER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // CUSTOM LOGIC: DRAFT characters can only send messages in chats with APPROVED participants
      if (senderCharacter.playerStatus === 'draft') {
        const allParticipants = await Character.find({
          _id: { $in: chat.participants }
        });

        const nonApprovedParticipants = allParticipants.filter(p => p.playerStatus !== 'approved');

        if (nonApprovedParticipants.length > 0) {
          logger.warn('SECURITY: DRAFT character attempted to send message to non-APPROVED chat', {
            senderId: characterId,
            senderPlayerStatus: senderCharacter.playerStatus,
            chatId,
            nonApprovedParticipants: nonApprovedParticipants.map(p => ({
              id: p._id,
              playerStatus: p.playerStatus
            })),
            userId: req.user?.userId
          });
          res.status(403).json(errorResponse(
            'I personaggi DRAFT possono inviare messaggi solo in chat con personaggi APPROVATI',
            'DRAFT_CHAT_RESTRICTION',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      // Create message
      const message = new OffGameChatMessage({
        chatId,
        senderId: characterId,
        content: content.trim(),
        replyTo: replyTo || undefined,
        sentAt: new Date(),
        deliveredTo: [characterId] // Sender automatically delivered
      });

      await message.save();

      // Update chat's last activity and message
      chat.lastActivity = new Date();
      chat.lastMessage = message._id;
      await chat.save();

      // Emit WebSocket event for real-time delivery to all participants
      const io = req.app.get('io'); // Get Socket.io instance
      if (io) {
        // Get all chat participants
        const participants = await OffGameChatParticipant.find({
          chatId: chatId,
          isActive: true
        }).select('characterId');

        const notificationData = {
          chatId: chatId,
          messageId: message._id.toString(),
          senderId: characterId,
          senderName: req.character!.characterName,
          content: content.trim(),
          messageType: 'user' as const,
          timestamp: message.sentAt,
          isRead: false
        };

        // Send notification to each participant's personal room (except sender)
        for (const participant of participants) {
          // Skip notification for the message sender
          if (participant.characterId.toString() !== characterId) {
            const participantRoom = `character_${participant.characterId}`;
            io.to(participantRoom).emit('offgame_message_received', notificationData);
          }
        }
        
        const notifiedParticipants = participants.filter(p => p.characterId.toString() !== characterId);
        logger.info(`OffGame message broadcasted to ${notifiedParticipants.length} participants (excluding sender)`, {
          chatId,
          sender: characterId,
          notifiedParticipants: notifiedParticipants.map(p => p.characterId)
        });
      }
      
      const populatedMessage = await OffGameChatMessage.findById(message._id)
        .populate('senderId', 'name avatar')
        .populate('replyTo');

      logger.info('OffGame message sent', {
        messageId: message._id,
        chatId,
        senderId: characterId
      });

      res.status(201).json(createResponse(
        populatedMessage?.toJSON(),
        'Message sent successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Send message error:', error);

      res.status(500).json(errorResponse(
        'Failed to send message',
        'SEND_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /game/offgame-chats/:id/name  
   * Update chat name (group chats only)
   */
  static async updateChatName(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const { name } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Chat name is required',
          'NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (name.trim().length > 50) {
        res.status(400).json(errorResponse(
          'Chat name too long (max 50 characters)',
          'NAME_TOO_LONG',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find chat and verify user is admin
      const chat = await OffGameChat.findOne({
        _id: chatId,
        participants: characterId,
        isActive: true,
        type: 'group' // Only group chats can be renamed
      });

      if (!chat) {
        res.status(404).json(errorResponse(
          'Group chat not found or access denied',
          'CHAT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if user is admin of the group
      const characterObjectId = new mongoose.Types.ObjectId(characterId);
      if (!chat.admins.some((admin: any) => admin.equals(characterObjectId))) {
        res.status(403).json(errorResponse(
          'Only group admins can rename the chat',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Update chat name
      chat.name = name.trim();
      chat.lastActivity = new Date();
      await chat.save();

      // Create system message about name change
      const character = await Character.findById(characterId);
      const systemMessage = new OffGameChatMessage({
        chatId: chat._id,
        senderId: characterObjectId,
        content: `${character?.name || 'Unknown'} ha modificato il nome del gruppo in "${name.trim()}"`,
        messageType: 'system',
        sentAt: new Date()
      });

      await systemMessage.save();
      chat.lastMessage = systemMessage._id;
      await chat.save();

      // Emit WebSocket event for real-time update to all participants
      const io = req.app.get('io');
      if (io) {
        // Get all chat participants
        const participants = await OffGameChatParticipant.find({
          chatId: chatId,
          isActive: true
        }).select('characterId');

        const eventData = {
          type: 'name_change' as const,
          chatId: chatId,
          timestamp: new Date().toISOString(),
          data: {
            name: chat.name,
            lastActivity: chat.lastActivity
          }
        };

        // Send notification to each participant's personal room
        for (const participant of participants) {
          const participantRoom = `character_${participant.characterId}`;
          io.to(participantRoom).emit('offgame_chat_updated', eventData);
        }
        
        logger.info(`Chat name change broadcasted to ${participants.length} participants`, {
          chatId,
          newName: chat.name,
          participants: participants.map(p => p.characterId)
        });
      }

      logger.info(`Chat ${chatId} renamed to "${name.trim()}" by ${characterId}`);

      res.json(updateResponse(
        undefined,
        'Chat name updated successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Update chat name error:', error);

      res.status(500).json(errorResponse(
        'Failed to update chat name',
        'UPDATE_CHAT_NAME_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/offgame-chats/:id/leave
   * Leave chat
   */
  static async leaveChat(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;

      // Find participant record
      const participant = await OffGameChatParticipant.findOne({
        chatId,
        characterId,
        isActive: true
      });

      if (!participant) {
        res.status(404).json(errorResponse(
          'You are not a participant in this chat',
          'NOT_PARTICIPANT',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Leave the chat
      participant.leave();
      await participant.save();

      // Remove from chat participants
      await OffGameChat.findByIdAndUpdate(chatId, {
        $pull: { participants: characterId },
        lastActivity: new Date()
      });

      // Create system message
      const character = await Character.findById(characterId);
      const systemMessage = new OffGameChatMessage({
        chatId,
        senderId: characterId,
        content: `${character?.name || 'Unknown'} ha lasciato la chat`,
        messageType: 'system',
        sentAt: new Date()
      });

      await systemMessage.save();

      logger.info('Character left OffGame chat', {
        chatId,
        characterId
      });

      res.json(successResponse(
        undefined,
        'Left chat successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Leave chat error:', error);

      res.status(500).json(errorResponse(
        'Impossibile uscire dalla chat',
        'LEAVE_CHAT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}