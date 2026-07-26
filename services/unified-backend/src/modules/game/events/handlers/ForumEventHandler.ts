/**
 * Forum Event Handler
 *
 * Handles forum realtime events published to Redis channel 'forum:events'
 * (see modules/forum/controllers/ForumController.ts and
 * modules/forum/services/NotificationService.ts for publishers).
 *
 * discussion_created/post_created are broadcast globally (io.emit) - like
 * global_presence_update, there's no per-topic room to join client-side yet,
 * so any connected client can decide whether to react (e.g. invalidate a
 * react-query cache for the currently open bacheca). notification_new is
 * targeted to the recipient character's socket only.
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../logger';

export class ForumEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return ['discussion_created', 'post_created', 'notification_new'];
  }

  async handle(event: RedisEvent): Promise<void> {
    const eventType = event.type;
    this.logEventHandling(eventType, event);

    switch (eventType) {
      case 'discussion_created':
        await this.handleDiscussionCreated(event);
        break;

      case 'post_created':
        await this.handlePostCreated(event);
        break;

      case 'notification_new':
        await this.handleNotificationNew(event);
        break;

      default:
        logger.debug(`[ForumEventHandler] Unhandled event type: ${eventType}`);
    }
  }

  private async handleDiscussionCreated(event: any): Promise<void> {
    this.io.emit('forum:discussion:created', {
      discussionId: event.discussionId,
      topicId: event.topicId,
      topicSlug: event.topicSlug,
      discussionSlug: event.discussionSlug,
      title: event.title,
      createdBy: event.createdBy,
      timestamp: event.timestamp
    });
  }

  private async handlePostCreated(event: any): Promise<void> {
    this.io.emit('forum:post:created', {
      postId: event.postId,
      topicId: event.topicId,
      topicSlug: event.topicSlug,
      discussionId: event.discussionId,
      discussionSlug: event.discussionSlug,
      authorCharacterId: event.authorCharacterId,
      authorCharacterName: event.authorCharacterName,
      timestamp: event.timestamp
    });
  }

  private async handleNotificationNew(event: any): Promise<void> {
    if (!event.characterId) return;

    const characterSocket = await this.findCharacterSocket(event.characterId);
    if (characterSocket) {
      characterSocket.emit('forum:notification:new', {
        notificationId: event.notificationId,
        notificationType: event.notificationType,
        title: event.title,
        message: event.message,
        topicSlug: event.topicSlug,
        discussionSlug: event.discussionSlug,
        timestamp: event.timestamp
      });
    }
  }
}
