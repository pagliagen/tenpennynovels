import type { FeatureManifest } from '@core/features/types';
import internalRoutes from './routes/internal';

/**
 * Ponte verso il servizio bot locale (bot-service/ nella root del repo).
 *
 * - Uscita: Chat.ts pubblica `bot:chat:message` su Redis a ogni nuovo
 *   messaggio standard (vedi shared/services/BotChatEventPublisher.ts).
 * - Ingresso: POST /internal/bot-chat/messages, protetto da
 *   BOT_SERVICE_SECRET, pubblica la risposta come personaggio bot.
 *
 * L'API gateway non inoltra /internal: l'endpoint è raggiungibile solo
 * direttamente sulla 3001 (uso locale). Senza secret risponde 404.
 *
 * dependsOn: ['fineSessione'] — la risposta del bot entra nella
 * segmentazione in scene come ogni altro messaggio standard.
 */
export const botChat: FeatureManifest = {
  key: 'botChat',
  title: 'Bot chat',
  description: 'Endpoint interno per le risposte del servizio bot locale',
  dependsOn: ['fineSessione'],
  routes: [
    { scope: 'public', path: '/internal/bot-chat', router: internalRoutes, gated: false },
  ],
};
