import { Request, Response } from 'express';
import { OffGameChat, OffGameChatMessage, OffGameChatParticipant, Character } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

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
        const response: ApiResponse = {
          success: false,
          error: 'Invalid chat type. Must be "direct" or "group"',
          code: 'INVALID_CHAT_TYPE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (type === 'group' && (!name || name.trim().length === 0)) {
        const response: ApiResponse = {
          success: false,
          error: 'Group name is required for group chats',
          code: 'GROUP_NAME_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!participants || !Array.isArray(participants) || participants.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'At least one participant is required',
          code: 'PARTICIPANTS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Group size limit
      if (type === 'group' && participants.length > 5) {
        const response: ApiResponse = {
          success: false,
          error: 'Group chats are limited to 5 participants maximum',
          code: 'GROUP_SIZE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Direct chat can only have 1 other participant
      if (type === 'direct' && participants.length !== 1) {
        const response: ApiResponse = {
          success: false,
          error: 'Direct chats must have exactly one other participant',
          code: 'INVALID_DIRECT_CHAT_SIZE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Convert string IDs to ObjectIds and verify all participants exist
      const currentCharacterObjectId = new mongoose.Types.ObjectId(characterId);
      const participantIds = participants.map(id => new mongoose.Types.ObjectId(id));
      const allParticipants = [...participantIds, currentCharacterObjectId];
      
      const characters = await (Character.find({ 
        _id: { $in: allParticipants },
        status: { $in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] }
      }) as any);

      if (characters.length !== allParticipants.length) {
        const response: ApiResponse = {
          success: false,
          error: 'One or more participants are invalid',
          code: 'INVALID_PARTICIPANTS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
          const response: ApiResponse = {
            success: true,
            data: existingChat.toJSON(),
            message: 'Direct chat already exists',
            timestamp: new Date().toISOString()
          };
          res.json(response);
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
        const creator = characters.find(c => c._id.equals(currentCharacterObjectId));
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

      const response: ApiResponse = {
        success: true,
        data: chat.toJSON(),
        message: 'Chat created successfully',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      logger.error('Create chat error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to create chat',
        code: 'CREATE_CHAT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          chats: chatData,
          pagination: {
            page,
            limit,
            total: chatData.length,
            hasMore: chatData.length === limit
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Get chats error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to get chats',
        code: 'GET_CHATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/offgame-chats/:id/messages
   * Get chat messages
   */
  static async getChatMessages(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'Chat not found or access denied',
          code: 'CHAT_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          chatId,
          messages: messages.reverse(), // Reverse to show oldest first
          pagination: {
            page,
            limit,
            hasMore: messages.length === limit
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Get chat messages error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to get chat messages',
        code: 'GET_CHAT_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/offgame-chats/:id/messages
   * Send message to chat
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const { content, replyTo } = req.body;

      // Validation
      if (!content || content.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Message content is required',
          code: 'MESSAGE_CONTENT_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (content.length > 2000) {
        const response: ApiResponse = {
          success: false,
          error: 'Message too long (max 2000 characters)',
          code: 'MESSAGE_TOO_LONG',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Verify chat exists and user is participant
      const chat = await OffGameChat.findOne({
        _id: chatId,
        participants: characterId,
        isActive: true
      });

      if (!chat) {
        const response: ApiResponse = {
          success: false,
          error: 'Chat not found or access denied',
          code: 'CHAT_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if user is muted
      const participant = await OffGameChatParticipant.findOne({
        chatId,
        characterId,
        isActive: true
      });

      if (participant?.isMuted) {
        const response: ApiResponse = {
          success: false,
          error: `You are muted until ${participant.mutedUntil?.toISOString()}`,
          code: 'USER_MUTED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
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

      const response: ApiResponse = {
        success: true,
        data: populatedMessage?.toJSON(),
        message: 'Message sent successfully',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      logger.error('Send message error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to send message',
        code: 'SEND_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * PATCH /game/offgame-chats/:id/name  
   * Update chat name (group chats only)
   */
  static async updateChatName(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const { name } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Chat name is required',
          code: 'NAME_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (name.trim().length > 50) {
        const response: ApiResponse = {
          success: false,
          error: 'Chat name too long (max 50 characters)',
          code: 'NAME_TOO_LONG',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Group chat not found or access denied',
          code: 'CHAT_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if user is admin of the group
      const characterObjectId = new mongoose.Types.ObjectId(characterId);
      if (!chat.admins.some(admin => admin.equals(characterObjectId))) {
        const response: ApiResponse = {
          success: false,
          error: 'Only group admins can rename the chat',
          code: 'INSUFFICIENT_PERMISSIONS',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Update chat name
      chat.name = name.trim();
      chat.lastActivity = new Date();
      await chat.save();

      // Create system message about name change
      const character = await (Character.findById(characterId) as any);
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

      const response: ApiResponse = {
        success: true,
        message: 'Chat name updated successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Update chat name error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to update chat name',
        code: 'UPDATE_CHAT_NAME_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/offgame-chats/:id/leave
   * Leave chat
   */
  static async leaveChat(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'You are not a participant in this chat',
          code: 'NOT_PARTICIPANT',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
      const character = await (Character.findById(characterId) as any);
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

      const response: ApiResponse = {
        success: true,
        message: 'Left chat successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      logger.error('Leave chat error:', error);

      const response: ApiResponse = {
        success: false,
        error: 'Failed to leave chat',
        code: 'LEAVE_CHAT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}