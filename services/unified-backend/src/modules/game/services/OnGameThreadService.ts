import mongoose from 'mongoose';
import { OnGameThread } from '@database/models/OnGameThread';
import { logger } from '@shared/utils/logger';

/**
 * OnGameThreadService
 *
 * Service layer for on-game message threads (1-to-1 postal system).
 *
 * Features:
 * - Find or create thread between two participants
 * - List threads with pagination
 * - Soft delete per-participant
 * - Update thread metadata after new message
 * - Unread count management
 */
export class OnGameThreadService {
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
      const orderedParticipants = OnGameThread.orderParticipants(participant1, participant2);

      // Try to find existing thread
      let thread = await OnGameThread.findOne({
        participants: { $all: orderedParticipants }
      });

      // Create if not exists
      if (!thread) {
        thread = await OnGameThread.create({
          participants: orderedParticipants,
          lastMessageAt: new Date(),
          lastMessageSubject: '(Nuovo thread)',
          lastMessagePreview: '(Nessun messaggio)',
          unreadCount: new Map(),
          deletedBy: []
        });

        logger.info('OnGame thread created', {
          threadId: thread._id,
          participants: orderedParticipants.map((p: mongoose.Types.ObjectId) => p.toString())
        });
      }

      return thread;
    } catch (error) {
      logger.error('Error finding or creating OnGame thread', {
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

      const total = await OnGameThread.countDocuments(query);
      const threads = await OnGameThread.find(query)
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
      logger.error('Error listing OnGame threads', { error, characterId: characterId.toString() });
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
      const thread = await OnGameThread.findById(threadId);
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

      logger.info('OnGame thread marked deleted', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error marking OnGame thread deleted', {
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
   * @param subject - Message subject
   * @param preview - Message preview (first 500 chars)
   */
  static async updateThreadMetadata(
    threadId: mongoose.Types.ObjectId,
    subject: string,
    preview: string
  ): Promise<void> {
    try {
      await OnGameThread.findByIdAndUpdate(threadId, {
        lastMessageAt: new Date(),
        lastMessageSubject: subject,
        lastMessagePreview: preview.substring(0, 500)
      });

      logger.debug('OnGame thread metadata updated', { threadId: threadId.toString() });
    } catch (error) {
      logger.error('Error updating OnGame thread metadata', {
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
      const thread = await OnGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      thread.incrementUnreadCount(characterId.toString());
      await thread.save();

      logger.debug('OnGame thread unread count incremented', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error incrementing OnGame thread unread count', {
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
      const thread = await OnGameThread.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      thread.resetUnreadCount(characterId.toString());
      await thread.save();

      logger.debug('OnGame thread unread count reset', {
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error resetting OnGame thread unread count', {
        error,
        threadId: threadId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }
}
