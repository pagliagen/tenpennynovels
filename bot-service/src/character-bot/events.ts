import { z } from 'zod';
import { environmentSchema } from './config';
import { replySchema } from './reply';

/** L'evento del gioco (pubblicato su Redis dal backend, `BotChatEventPublisher`) che arriva con ogni chiamata. */
export const chatEventSchema = z.object({
  eventId: z.string(),
  chatId: z.string(),
  characterId: z.string(),
  characterName: z.string(),
  locationId: z.string(),
  content: z.string(),
  actionType: z.string(),
  visibility: z.string(),
  isHidden: z.boolean().default(false),
  position: z.string().optional(),
  positionDescription: z.string().optional(),
  timestamp: z.string(),
});

export type ChatEvent = z.infer<typeof chatEventSchema>;

/** Una battuta della storia (i messaggi pubblici recenti della location, già scelti dal gioco). */
export const historyLineSchema = z.object({
  characterId: z.string(),
  characterName: z.string(),
  content: z.string().max(5000),
  position: z.string().optional(),
  positionDescription: z.string().optional(),
});

/** `POST /v1/character-bot/event`: chiamata dal gioco, attraverso il gateway. */
export const eventRequestSchema = z.object({
  environment: environmentSchema,
  locationId: z.string().min(1),
  event: chatEventSchema,
  history: z.array(historyLineSchema).max(50),
  reply: replySchema,
});

export type EventRequest = z.infer<typeof eventRequestSchema>;
