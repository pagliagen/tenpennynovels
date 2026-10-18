/**
 * Bot Chat Event Publisher
 *
 * Pubblica su Redis ogni nuovo messaggio `standard` della chat di una location,
 * con i campi di visibilità che l'evento di embedding non porta. Consumato dal
 * servizio locale bot-service/, che decide da solo se rispondere.
 */

import crypto from 'crypto';
import { redis } from '../../config/runtime/redis';
import { logger } from '@shared/utils/logger';

export const BOT_CHAT_CHANNEL = 'bot:chat:message';

export interface BotChatEventInput {
  _id: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
  visibility: string;
  isHidden?: boolean;
  /** Tag di posizione del messaggio (es. "Ingresso") e la sua descrizione dalla location. */
  position?: string;
  positionDescription?: string;
  timestamp: Date;
}

export async function publishBotChatEvent(chat: BotChatEventInput): Promise<void> {
  try {
    await redis.publish(BOT_CHAT_CHANNEL, JSON.stringify({
      eventId: crypto.randomUUID(),
      chatId: chat._id,
      characterId: chat.characterId,
      characterName: chat.characterName,
      locationId: chat.locationId,
      content: chat.content,
      actionType: chat.actionType,
      visibility: chat.visibility,
      isHidden: !!chat.isHidden,
      position: chat.position || undefined,
      positionDescription: chat.positionDescription || undefined,
      timestamp: chat.timestamp.toISOString(),
    }));
  } catch (error: unknown) {
    logger.error('[BotChatEvent] Failed to publish:', error);
  }
}
