import mongoose from 'mongoose';
import { OffGameThread } from '@database/models/OffGameThread';
import { logger } from '@shared/utils/logger';

/**
 * OffGameThreadService
 *
 * Service layer for off-game chat threads (1-to-1 OOC chat).
 *
 * Features:
 * - Find or create thread between two participants
 * - List threads with pagination
 * - Soft delete per-participant
 * - Update thread metadata after new message
 * - Unread count management
 * - Typing indicators (real-time chat UX)
 */
export class OffGameThreadService {
  /**
   * Find existing thread or create new one between two participants
   *
   * CRITICAL: Participants are always ordered to prevent A↔B vs B↔A duplicates
   *
   * @param participant1 - First character ID
   * @param participant2 - Second character ID
   * @returns Thread document
   */
  static async findOrCreateThread(
    participant1: mongoose.Types.ObjectId,
    participant2: mongoose.Types.ObjectId
  ): Promise<any> {
    try {
      // Order participants (prevents duplicates)
      const orderedParticipants = OffGameThread.orderParticipants(participant1, participant2);

      // Try to find existing thread
      let thread = await OffGameThread.findOne({
        participants: { $all: orderedParticipants }
      });

      // Create if not exists
      if (!thread) {
        thread = await OffGameThread.create({
          participants: orderedParticipants,
          lastMessageAt: new Date(),
          lastMessagePreview: '',
          unreadCount: new Map(),
          typingIndicators: [],
          deletedBy: []
        });

        logger.info('OffGame thread created', {
          threadId: thread._id,
          participants: orderedParticipants.map((p: mongoose.Types.ObjectId) => p.toString())
        });
      }

      return thread;
    } catch (error) {
      logger.error('Error finding or creating OffGame thread', {
        error,
        participant1: participant1.toString(),
        participant2: participant2.toString()
      });
      throw error;
    }
  }

  /**
   * List threads for a character with pagination
   *
   * @param characterId - Character ID
   * @param includeDeleted - Include threads deleted by this character
   * @param page - Page number (1-indexed)
   * @param limit - Results per page
   * @returns Thread list with pagination metadata
   */
  static async listThreads(
    characterId: mongoose.Types.ObjectId,
    includeDeleted = false,
    page = 1,
    limit = 25
  ): Promise<{ threads: any[]; total: number; page: number; totalPages: number }> {
    try {
      const query: any = {
        participants: characterId
      };

      // Exclude deleted threads unless requested
      if (!includeDeleted) {
        query['deletedBy.characterId'] = { $ne: characterId };
      }

      const total = await OffGameThread.countDocuments(query);
      const threads = await OffGameThread.find(query)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('participants', 'name surname avatar')
        .lean();

      return {
        threads,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error listing OffGame threads', { error, characterId: characterId.toString() });
      throw error;
    }
  }

  /**
   * Mark thread as deleted by character (soft delete)
   *
   * @param threadId - Thread ID
   * @param characterId - Character ID
   */
  static async markThreadDeleted(
    threadId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const thread = await OffGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Verify character is participant
      const isParticipant = thread.participants.some(p => p.equals(characterId));
      if (!isParticipant) {
        throw new Error('Character is not a participant in this thread');
      }

      // Mark as deleted
      thread.markDeletedBy(characterId);
      await thread.save();

      logger.info('OffGame thread marked deleted', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error marking OffGame thread deleted', {
        error,
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }

  /**
   * Update thread metadata after new message
   *
   * @param threadId - Thread ID
   * @param preview - Message preview (first 500 chars)
   */
  static async updateThreadMetadata(
    threadId: mongoose.Types.ObjectId,
    preview: string
  ): Promise<void> {
    try {
      await OffGameThread.findByIdAndUpdate(threadId, {
        lastMessageAt: new Date(),
        lastMessagePreview: preview.substring(0, 500)
      });

      logger.debug('OffGame thread metadata updated', { threadId: threadId.toString() });
    } catch (error) {
      logger.error('Error updating OffGame thread metadata', {
        error,
        threadId: threadId.toString()
      });
      throw error;
    }
  }

  /**
   * Increment unread count for character
   *
   * @param threadId - Thread ID
   * @param characterId - Character ID
   */
  static async incrementUnreadCount(
    threadId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const thread = await OffGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      thread.incrementUnreadCount(characterId.toString());
      await thread.save();

      logger.debug('OffGame thread unread count incremented', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error incrementing OffGame thread unread count', {
        error,
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }

  /**
   * Reset unread count for character
   *
   * @param threadId - Thread ID
   * @param characterId - Character ID
   */
  static async resetUnreadCount(
    threadId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const thread = await OffGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      thread.resetUnreadCount(characterId.toString());
      await thread.save();

      logger.debug('OffGame thread unread count reset', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error resetting OffGame thread unread count', {
        error,
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }

  /**
   * Update typing indicator for character
   *
   * Used for real-time chat UX (WhatsApp-style "user is typing...")
   *
   * @param threadId - Thread ID
   * @param characterId - Character ID
   */
  static async updateTypingIndicator(
    threadId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const thread = await OffGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      thread.updateTypingIndicator(characterId);
      await thread.save();

      logger.debug('OffGame thread typing indicator updated', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error updating OffGame thread typing indicator', {
        error,
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }
}
