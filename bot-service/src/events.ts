import { z } from 'zod';

export const BOT_CHAT_CHANNEL = 'bot:chat:message';

/** Payload pubblicato da unified-backend (shared/services/BotChatEventPublisher.ts). */
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

export function parseChatEvent(raw: string): ChatEvent | null {
  try {
    const result = chatEventSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
