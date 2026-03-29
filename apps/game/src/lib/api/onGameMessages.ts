/**
 * OnGame Messages API Client
 *
 * Victorian postal system - IN-CHARACTER messaging
 * Communicates with NEW backend endpoints (NO backwards compatibility)
 */

import { apiClient } from './client';

// ============================================
// Types (aligned with NEW backend schema)
// ============================================

export interface PopulatedCharacter {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string;
}

export interface OnGameThread {
  _id: string;
  participants: PopulatedCharacter[]; // Array of 2 characters (populated by backend)
  lastMessageAt: string; // ISO date
  lastMessageSubject: string;
  lastMessagePreview: string;
  unreadCount: Record<string, number>; // Map<characterId, count>
  deletedBy: Array<{ characterId: string; deletedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface OnGameMessage {
  _id: string;
  onGameThreadId: string;
  senderId: string;
  recipientId: string;
  messageType: 'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer';
  subject: string;
  content: string;
  deliveryConfig: {
    deliveryDelay: number; // milliseconds
    cost: number; // credits
    canReply: boolean;
    displayName: string;
  };
  sentAt: string; // ISO date
  scheduledDelivery?: string; // ISO date
  deliveredAt?: string; // ISO date
  deletedBy?: {
    sender?: string; // ISO date
    recipient?: string; // ISO date
  };
  replyTo?: string; // Message ID
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  recipientIds: string[]; // Multi-recipient support
  messageType: 'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer';
  subject: string;
  content: string;
  replyTo?: string; // Message ID
}

export interface SendMessageResponse {
  sent: number;
  failed: number;
  messages: OnGameMessage[];
  creditsSpent: number;
}

export interface ThreadListResponse {
  threads: OnGameThread[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface MessageListResponse {
  list: OnGameMessage[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ThreadDetailResponse {
  thread: OnGameThread;
  messages: OnGameMessage[];
}

// ============================================
// API Client
// ============================================

export const onGameMessagesApi = {
  /**
   * Send on-game message (multi-recipient support)
   * POST /game/messages
   */
  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await apiClient.post<{ success: boolean; data: SendMessageResponse }>(
      '/game/messages',
      data
    );
    return response.data.data;
  },

  /**
   * Get inbox (received messages)
   * GET /game/messages/inbox
   */
  async getInbox(page = 1, limit = 25): Promise<MessageListResponse> {
    const response = await apiClient.get<{ success: boolean; list: OnGameMessage[]; pagination: any }>(
      '/game/messages/inbox',
      { params: { page, limit } }
    );
    return {
      list: response.data.list,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get sent messages
   * GET /game/messages/sent
   */
  async getSent(page = 1, limit = 25): Promise<MessageListResponse> {
    const response = await apiClient.get<{ success: boolean; list: OnGameMessage[]; pagination: any }>(
      '/game/messages/sent',
      { params: { page, limit } }
    );
    return {
      list: response.data.list,
      pagination: response.data.pagination,
    };
  },

  /**
   * List all threads (paginated)
   * GET /game/ongame-threads
   */
  async getThreads(page = 1, limit = 25, includeDeleted = false): Promise<ThreadListResponse> {
    const response = await apiClient.get<{ success: boolean; data: ThreadListResponse }>(
      '/game/ongame-threads',
      { params: { page, limit, includeDeleted } }
    );
    return response.data.data;
  },

  /**
   * Get single thread with messages
   * GET /game/ongame-threads/:id
   */
  async getThread(threadId: string): Promise<ThreadDetailResponse> {
    const response = await apiClient.get<{ success: boolean; data: ThreadDetailResponse }>(
      `/game/ongame-threads/${threadId}`
    );
    return response.data.data;
  },

  /**
   * Delete message (soft delete)
   * DELETE /game/messages/:id
   */
  async deleteMessage(messageId: string): Promise<void> {
    await apiClient.delete(`/game/messages/${messageId}`);
  },
};
