import mongoose from 'mongoose';
import { ForumNotification, ForumNotificationType, ForumDiscussionSubscription, ForumPost } from '@database/models';
import { Character } from '@database/models/Character';
import { logger } from '../logger';

/**
 * NotificationService
 * Centralized service for creating forum notifications
 * Handles all 4 notification types with proper triggers
 */

interface NotificationData {
  characterId: mongoose.Types.ObjectId;
  type: ForumNotificationType;
  title: string;
  message: string;
  relatedDiscussionId?: mongoose.Types.ObjectId;
  relatedPostId?: mongoose.Types.ObjectId;
  triggeredByCharacterId?: mongoose.Types.ObjectId;
  triggeredByCharacterName?: string;
}

export class NotificationService {
  /**
   * Create a single notification
   * @private
   */
  private static async createNotification(data: NotificationData): Promise<void> {
    try {
      await ForumNotification.create({
        characterId: data.characterId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedDiscussionId: data.relatedDiscussionId,
        relatedPostId: data.relatedPostId,
        triggeredByCharacterId: data.triggeredByCharacterId,
        triggeredByCharacterName: data.triggeredByCharacterName,
        isRead: false,
        createdAt: new Date()
      });
    } catch (error: any) {
      logger.error('[NotificationService] Failed to create notification:', error.message);
      // Don't throw - notifications are non-critical, shouldn't break the main flow
    }
  }

  /**
   * Notification Type 1: new_post_in_subscribed_discussion
   * Trigger: When a new post is created in a discussion
   * Recipients: All characters subscribed to the discussion EXCEPT the post author
   */
  static async notifyNewPostInSubscription(params: {
    discussionId: mongoose.Types.ObjectId;
    discussionTitle: string;
    postId: mongoose.Types.ObjectId;
    authorCharacterId: mongoose.Types.ObjectId;
    authorCharacterName: string;
  }): Promise<void> {
    try {
      // Get all subscribers for this discussion
      const subscriptions = await ForumDiscussionSubscription.find({
        discussionId: params.discussionId
      });

      // Create notifications for all subscribers except the author
      const notifications = subscriptions
        .filter(sub => !sub.characterId.equals(params.authorCharacterId))
        .map(sub => ({
          characterId: sub.characterId,
          type: 'new_post_in_subscribed_discussion' as ForumNotificationType,
          title: `Nuovo post in "${params.discussionTitle}"`,
          message: `${params.authorCharacterName} ha risposto alla discussione`,
          relatedDiscussionId: params.discussionId,
          relatedPostId: params.postId,
          triggeredByCharacterId: params.authorCharacterId,
          triggeredByCharacterName: params.authorCharacterName
        }));

      // Create all notifications in parallel
      await Promise.all(
        notifications.map(notif => this.createNotification(notif))
      );

      logger.info(`[NotificationService] Sent ${notifications.length} notifications for new post in discussion`);
    } catch (error: any) {
      logger.error('[NotificationService] Failed to notify new post:', error.message);
    }
  }

  /**
   * Notification Type 2: character_followed_you
   * Trigger: When a character follows another character
   * Recipient: The character being followed
   */
  static async notifyCharacterFollowed(params: {
    followedCharacterId: mongoose.Types.ObjectId;
    followerCharacterId: mongoose.Types.ObjectId;
    followerCharacterName: string;
  }): Promise<void> {
    try {
      await this.createNotification({
        characterId: params.followedCharacterId,
        type: 'character_followed_you',
        title: `${params.followerCharacterName} ti sta seguendo`,
        message: 'Ora seguono la tua attività nel forum',
        triggeredByCharacterId: params.followerCharacterId,
        triggeredByCharacterName: params.followerCharacterName
      });

      logger.info('[NotificationService] Notified character about new follower');
    } catch (error: any) {
      logger.error('[NotificationService] Failed to notify character follow:', error.message);
    }
  }

  /**
   * Notification Type 3: reaction_on_your_post
   * Trigger: When someone reacts to a post
   * Recipient: The post author (if not the reactor)
   */
  static async notifyReactionOnPost(params: {
    postId: mongoose.Types.ObjectId;
    postAuthorCharacterId: mongoose.Types.ObjectId;
    reactorCharacterId: mongoose.Types.ObjectId;
    reactorCharacterName: string;
    reactionType: 'like' | 'love' | 'laugh' | 'think';
  }): Promise<void> {
    try {
      // Don't notify if author reacted to their own post
      if (params.postAuthorCharacterId.equals(params.reactorCharacterId)) {
        return;
      }

      // Emoji mapping
      const emojiMap: Record<string, string> = {
        like: '👍',
        love: '❤️',
        laugh: '😂',
        think: '🤔'
      };

      await this.createNotification({
        characterId: params.postAuthorCharacterId,
        type: 'reaction_on_your_post',
        title: 'Reazione al tuo post',
        message: `${params.reactorCharacterName} ha reagito con ${emojiMap[params.reactionType]}`,
        relatedPostId: params.postId,
        triggeredByCharacterId: params.reactorCharacterId,
        triggeredByCharacterName: params.reactorCharacterName
      });

      logger.info('[NotificationService] Notified post author about reaction');
    } catch (error: any) {
      logger.error('[NotificationService] Failed to notify reaction:', error.message);
    }
  }

  /**
   * Notification Type 4: reply_to_your_post
   * Trigger: When someone replies to a specific post (using replyToPostId)
   * Recipient: The original post author (if not the replier)
   */
  static async notifyReplyToPost(params: {
    originalPostId: mongoose.Types.ObjectId;
    originalPostAuthorId: mongoose.Types.ObjectId;
    replyPostId: mongoose.Types.ObjectId;
    replierCharacterId: mongoose.Types.ObjectId;
    replierCharacterName: string;
    discussionId: mongoose.Types.ObjectId;
  }): Promise<void> {
    try {
      // Don't notify if author replied to their own post
      if (params.originalPostAuthorId.equals(params.replierCharacterId)) {
        return;
      }

      await this.createNotification({
        characterId: params.originalPostAuthorId,
        type: 'reply_to_your_post',
        title: 'Risposta al tuo post',
        message: `${params.replierCharacterName} ha risposto al tuo messaggio`,
        relatedDiscussionId: params.discussionId,
        relatedPostId: params.replyPostId,
        triggeredByCharacterId: params.replierCharacterId,
        triggeredByCharacterName: params.replierCharacterName
      });

      logger.info('[NotificationService] Notified post author about reply');
    } catch (error: any) {
      logger.error('[NotificationService] Failed to notify reply:', error.message);
    }
  }
}
