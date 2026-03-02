import { OffGameChat, OffGameChatMessage, OffGameChatParticipant, Character, db } from '@database/models';
import { logger } from '../utils/logger';

const mongoose = db.getMongoose();

export interface CreateOrGetDirectChatParams {
  /** ID del character che invia il messaggio */
  fromCharacterId: string;
  /** ID del character destinatario */
  toCharacterId: string;
}

export interface SendMessageParams {
  /** ID della chat */
  chatId: string;
  /** ID del character mittente */
  fromCharacterId: string;
  /** Contenuto del messaggio */
  content: string;
  /** Message type (default: 'user') */
  messageType?: 'user' | 'system';
  /** ID del messaggio a cui si risponde (opzionale) */
  replyTo?: string;
}

/**
 * Service layer for OffGame Chat operations
 * Provides reusable business logic for both HTTP controllers and internal services
 */
export class OffGameChatService {
  /**
   * Create or get existing direct chat between two characters
   * If direct chat already exists, returns it. Otherwise creates a new one.
   */
  static async createOrGetDirectChat(params: CreateOrGetDirectChatParams) {
    const { fromCharacterId, toCharacterId } = params;

    logger.info('OffGameChatService.createOrGetDirectChat', {
      fromCharacterId,
      toCharacterId
    });

    // Convert to ObjectIds
    const fromObjectId = new mongoose.Types.ObjectId(fromCharacterId);
    const toObjectId = new mongoose.Types.ObjectId(toCharacterId);
    const participants = [fromObjectId, toObjectId];

    // Verify both characters exist
    const characters = await Character.find({
      _id: { $in: participants },
      status: { $in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] }
    });

    if (characters.length !== 2) {
      throw new Error('One or both participants are invalid or not found');
    }

    // Check if direct chat already exists
    const existingChat = await OffGameChat.findOne({
      type: 'direct',
      participants: { $all: participants, $size: 2 },
      isActive: true
    });

    if (existingChat) {
      logger.info('Direct chat already exists', {
        chatId: existingChat._id,
        participants: participants.map(p => p.toString())
      });
      return existingChat;
    }

    // Create new direct chat
    const chat = new OffGameChat({
      type: 'direct',
      participants,
      admins: [], // Direct chats have no admins
      createdBy: fromObjectId,
      lastActivity: new Date()
    });

    await chat.save();

    // Create participant records
    const participantRecords = participants.map(participantId => ({
      chatId: chat._id,
      characterId: participantId,
      role: participantId.equals(fromObjectId) ? 'owner' : 'member',
      joinedAt: new Date()
    }));

    await OffGameChatParticipant.insertMany(participantRecords);

    logger.info('Direct chat created', {
      chatId: chat._id,
      participants: participants.map(p => p.toString())
    });

    return chat;
  }

  /**
   * Send message to an existing chat
   * Returns the created message with populated sender info
   */
  static async sendMessage(params: SendMessageParams) {
    const { chatId, fromCharacterId, content, messageType = 'user', replyTo } = params;

    logger.info('OffGameChatService.sendMessage', {
      chatId,
      fromCharacterId,
      contentLength: content.length,
      messageType
    });

    // Validation
    if (!content || content.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (content.length > 2000) {
      throw new Error('Message too long (max 2000 characters)');
    }

    // Verify chat exists
    const chat = await OffGameChat.findOne({
      _id: chatId,
      isActive: true
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    // Convert to ObjectId
    const fromObjectId = new mongoose.Types.ObjectId(fromCharacterId);

    // Verify sender is participant (only for user messages, system messages bypass this)
    if (messageType === 'user') {
      const isParticipant = chat.participants.some((p: any) => p.equals(fromObjectId));
      if (!isParticipant) {
        throw new Error('Sender is not a participant in this chat');
      }

      // Check if user is muted
      const participant = await OffGameChatParticipant.findOne({
        chatId,
        characterId: fromCharacterId,
        isActive: true
      });

      if (participant?.isMuted) {
        throw new Error(`User is muted until ${participant.mutedUntil?.toISOString()}`);
      }
    }

    // Create message
    const message = new OffGameChatMessage({
      chatId,
      senderId: fromObjectId,
      content: content.trim(),
      messageType,
      replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined,
      sentAt: new Date(),
      deliveredTo: [fromObjectId] // Sender automatically delivered
    });

    await message.save();

    // Update chat's last activity and message
    chat.lastActivity = new Date();
    chat.lastMessage = message._id;
    await chat.save();

    // Populate sender info before returning
    const populatedMessage = await OffGameChatMessage.findById(message._id)
      .populate('senderId', 'name avatar')
      .populate('replyTo');

    logger.info('Message sent successfully', {
      messageId: message._id,
      chatId,
      senderId: fromCharacterId
    });

    return populatedMessage;
  }

  /**
   * Get chat by ID
   */
  static async getChatById(chatId: string) {
    const chat = await OffGameChat.findOne({
      _id: chatId,
      isActive: true
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    return chat;
  }

  /**
   * Get all participants of a chat
   */
  static async getChatParticipants(chatId: string) {
    const participants = await OffGameChatParticipant.find({
      chatId,
      isActive: true
    }).select('characterId');

    return participants;
  }
}
