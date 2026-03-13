/**
 * OffGame Chat Types
 *
 * WhatsApp/Telegram-like instant messaging system for character-to-character communication.
 *
 * @module types/offGameChat
 * @since 2.0.0
 */

export type ChatType = 'direct' | 'group';

export interface ChatParticipant {
  _id: string;
  name: string;
  avatar?: string;
}

export interface ChatPreview {
  _id: string;
  type: ChatType;
  name?: string; // Group name (only for groups)
  participants: ChatParticipant[];
  lastMessage?: {
    _id: string;
    content: string;
    senderId: string;
    senderName: string;
    sentAt: string;
    messageType: 'user' | 'system';
  };
  unreadCount: number;
  isMuted: boolean;
  lastActivity: string;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;           // DB field (was sentAt)
  actionType: 'user' | 'system';  // DB field (was messageType)
  replyTo?: string;
  readBy: string[]; // Array of character IDs who read the message
}

export interface ChatDetail {
  chat: ChatPreview;
  messages: ChatMessage[];
}

export interface CreateChatPayload {
  type: ChatType;
  name?: string; // Required for group chats
  participants: string[]; // Character IDs (max 1 for direct, max 5 for group)
}

export interface SendMessagePayload {
  content: string;
  replyTo?: string; // Message ID to reply to
}

export interface TypingIndicator {
  chatId: string;
  characterId: string;
  characterName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ReadReceipt {
  chatId: string;
  characterId: string;
  characterName: string;
  lastReadMessageId: string;
  readAt: string;
}
