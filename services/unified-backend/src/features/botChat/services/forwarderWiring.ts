import { aiGateway } from '@core/ai';
import { Chat } from '@core/chat/models/Chat';
import { appConfig } from '@config/runtime';
import { redis } from '@config/runtime/redis';
import { logger } from '@shared/utils/logger';
import { BOT_CHAT_CHANNEL } from '@shared/services/BotChatEventPublisher';
import { botChatConfigStatus } from '../utils/botChatConfig';
import { BotChatForwarder, type BotRef, type HistoryLine } from './BotChatForwarder';

let forwarder: BotChatForwarder | null = null;

/** Gli ultimi messaggi che tutti i presenti vedono, dal più vecchio. */
async function loadHistory(locationId: string, limit: number): Promise<HistoryLine[]> {
  const rows = await Chat.find({ locationId, actionType: 'standard', visibility: 'public', isHidden: { $ne: true } })
    .select('characterId characterName content position timestamp')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  return rows.reverse().map((r) => ({
    characterId: String(r.characterId),
    characterName: String(r.characterName),
    content: String(r.content),
    position: r.position ? String(r.position) : undefined,
  }));
}

async function listBots(): Promise<BotRef[]> {
  const body = await aiGateway.call<{ bots?: { name: string; characterId: string; locationId: string | null }[] }>('character-bot', 'list', { environment: appConfig.botEnvironment }, { timeoutMs: 5_000 });
  return (body.bots ?? []).filter((b): b is BotRef => typeof b.locationId === 'string');
}

/**
 * Avvia l'inoltro solo con la configurazione completa. Con la chat spenta non fa nulla; abilitata ma incompleta,
 * dice una volta cosa manca (e non parte niente).
 */
export async function startBotChatForwarder(): Promise<void> {
  const status = botChatConfigStatus();
  if (!status.enabled) return;
  if (!status.complete || !status.replyBaseUrl) {
    logger.warn(`[BotChat] ENABLE_BOT_CHAT=true ma la configurazione è incompleta: la chat dei bot NON parte. Manca: ${status.missing.join('; ')}`);
    return;
  }

  forwarder = new BotChatForwarder({
    environment: appConfig.botEnvironment,
    replyBaseUrl: status.replyBaseUrl,
    secret: appConfig.services.botService.secret ?? '',
    isAvailable: () => aiGateway.isAvailable('character-bot'),
    listBots,
    loadHistory,
    send: async (payload) => { await aiGateway.call('character-bot', 'event', payload, { timeoutMs: 5_000 }); },
  });
  const f = forwarder;
  await redis.getSubscriber().subscribe(BOT_CHAT_CHANNEL, (message) => f.handleRaw(message));
  logger.info('[BotChat] Inoltro al servizio AI attivo', { environment: appConfig.botEnvironment, replyBaseUrl: status.replyBaseUrl });
}

/** Dopo aver creato un bot: l'elenco delle location con bot si rilegge subito. */
export function invalidateBotDirectory(): void {
  forwarder?.invalidate();
}
