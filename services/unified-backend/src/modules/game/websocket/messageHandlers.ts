import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@shared/utils/logger';

/**
 * MessageWebSocketService
 *
 * WebSocket notification system for messaging (on-game and off-game).
 *
 * Pattern: Backend emits events, frontend subscribes via WebSocketContext.
 *
 * Events:
 * - ongame:message_sent        → Sender notification (message queued/scheduled)
 * - ongame:message_delivered   → Recipient notification (message delivered)
 * - ongame:message_read        → Sender notification (read receipt)
 * - offgame:message_received   → Recipient notification (realtime chat)
 * - offgame:typing_indicator   → Typing indicator
 * - offgame:message_read       → Sender notification (read receipt)
 */
export class MessageWebSocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Emit on-game message sent notification to sender
   *
   * Use case: Sender confirmation after sending message
   *
   * @param params - Notification parameters
   */
  emitOnGameMessageSent(params: {
    senderId: string;
    messageId: string;
    onGameThreadId: string;
    recipientName: string;
    scheduledDelivery?: Date;
  }): void {
    try {
      this.io.to(`character:${params.senderId}`).emit('ongame:message_sent', {
        messageId: params.messageId,
        onGameThreadId: params.onGameThreadId,
        recipientName: params.recipientName,
        scheduledDelivery: params.scheduledDelivery?.toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.debug('Emitted ongame:message_sent', {
        senderId: params.senderId,
        messageId: params.messageId
      });
    } catch (error) {
      logger.error('Error emitting ongame:message_sent', { error, params });
    }
  }

  /**
   * Emit on-game message delivered notification to recipient
   *
   * Use case: Recipient notification when message is delivered (CRON job)
   *
   * @param params - Notification parameters
   */
  emitOnGameMessageDelivered(params: {
    recipientId: string;
    messageId: string;
    onGameThreadId: string;
    senderName: string;
    subject: string;
  }): void {
    try {
      this.io.to(`character:${params.recipientId}`).emit('ongame:message_delivered', {
        messageId: params.messageId,
        onGameThreadId: params.onGameThreadId,
        senderName: params.senderName,
        subject: params.subject,
        timestamp: new Date().toISOString()
      });

      logger.debug('Emitted ongame:message_delivered', {
        recipientId: params.recipientId,
        messageId: params.messageId
      });
    } catch (error) {
      logger.error('Error emitting ongame:message_delivered', { error, params });
    }
  }

  /**
   * Emit on-game message read notification to sender (read receipt)
   *
   * Use case: Sender notification when recipient reads message
   *
   * @param params - Notification parameters
   */
  emitOnGameMessageRead(params: {
    senderId: string;
    messageId: string;
    readBy: string;
    readByName: string;
    readAt: Date;
  }): void {
    try {
      this.io.to(`character:${params.senderId}`).emit('ongame:message_read', {
        messageId: params.messageId,
        readBy: params.readBy,
        readByName: params.readByName,
        readAt: params.readAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.debug('Emitted ongame:message_read', {
        senderId: params.senderId,
        messageId: params.messageId
      });
    } catch (error) {
      logger.error('Error emitting ongame:message_read', { error, params });
    }
  }

  /**
   * Emit off-game message received notification to recipient (realtime)
   *
   * Use case: Realtime chat - recipient gets message immediately
   *
   * @param params - Notification parameters
   */
  emitOffGameMessageReceived(params: {
    recipientId: string;
    messageId: string;
    offGameThreadId: string;
    senderId: string;
    senderName: string;
    content: string;
    sentAt: Date;
  }): void {
    try {
      this.io.to(`character:${params.recipientId}`).emit('offgame:message_received', {
        messageId: params.messageId,
        offGameThreadId: params.offGameThreadId,
        senderId: params.senderId,
        senderName: params.senderName,
        content: params.content,
        sentAt: params.sentAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.debug('Emitted offgame:message_received', {
        recipientId: params.recipientId,
        messageId: params.messageId
      });
    } catch (error) {
      logger.error('Error emitting offgame:message_received', { error, params });
    }
  }

  /**
   * Emit off-game typing indicator
   *
   * Use case: Show "User is typing..." in chat UI
   *
   * @param params - Notification parameters
   */
  emitOffGameTypingIndicator(params: {
    recipientId: string;
    senderId: string;
    senderName: string;
    isTyping: boolean;
  }): void {
    try {
      this.io.to(`character:${params.recipientId}`).emit('offgame:typing_indicator', {
        senderId: params.senderId,
        senderName: params.senderName,
        isTyping: params.isTyping,
        timestamp: Date.now()
      });

      logger.debug('Emitted offgame:typing_indicator', {
        recipientId: params.recipientId,
        senderId: params.senderId,
        isTyping: params.isTyping
      });
    } catch (error) {
      logger.error('Error emitting offgame:typing_indicator', { error, params });
    }
  }

  /**
   * Emit off-game message read notification to sender (read receipt)
   *
   * Use case: Double-check WhatsApp-style read receipt
   *
   * @param params - Notification parameters
   */
  emitOffGameMessageRead(params: {
    senderId: string;
    messageId: string;
    readBy: string;
    readByName: string;
    readAt: Date;
  }): void {
    try {
      this.io.to(`character:${params.senderId}`).emit('offgame:message_read', {
        messageId: params.messageId,
        readBy: params.readBy,
        readByName: params.readByName,
        readAt: params.readAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.debug('Emitted offgame:message_read', {
        senderId: params.senderId,
        messageId: params.messageId
      });
    } catch (error) {
      logger.error('Error emitting offgame:message_read', { error, params });
    }
  }
}

/**
 * Setup message WebSocket handlers
 *
 * Called from server.ts after WebSocket initialization
 *
 * @param io - Socket.IO server instance
 * @returns MessageWebSocketService instance
 */
export function setupMessageHandlers(io: SocketIOServer): MessageWebSocketService {
  const service = new MessageWebSocketService(io);

  logger.info('Message WebSocket handlers initialized');

  return service;
}
