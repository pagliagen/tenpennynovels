/**
 * Bot Chat Event Publisher
 *
 * Pubblica su Redis ogni nuovo messaggio `standard` della chat di una location,
 * con i campi di visibilità che l'evento di embedding non porta. Lo raccoglie
 * `BotChatForwarder` (features/botChat), che lo spinge al servizio AI; è lui a decidere se rispondere.
 * Non pubblica nulla se la chat dei bot non è abilitata e completa (`botChatConfigStatus`).
 */

import crypto from 'crypto';
import { redis } from '../../config/runtime/redis';
import { logger } from '@shared/utils/logger';
import { botChatConfigStatus } from '@features/botChat/api';

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
  // Solo con la configurazione completa: un pezzo mancante = non parte niente.
  if (!botChatConfigStatus().complete) return;
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
