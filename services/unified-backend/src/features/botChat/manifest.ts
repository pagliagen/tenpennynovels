import type { FeatureManifest } from '@core/features/types';
import botApiRoutes from './routes/botApi';

/**
 * La chat dei bot, con il servizio AI fuori dal gioco (oggi il Mac dello sviluppatore, domani un server dedicato).
 *
 * - Uscita: Chat.ts pubblica `bot:chat:message` su Redis a ogni nuovo messaggio standard
 *   (`shared/services/BotChatEventPublisher.ts`), **solo con la configurazione completa** (`utils/botChatConfig.ts`).
 *   `BotChatForwarder` lo spinge al servizio AI (gateway → bot-service) insieme all'indirizzo di risposta e a un
 *   token per evento (`utils/botToken.ts`), solo per le location che hanno un bot e solo se il servizio è raggiungibile.
 * - Ingresso: `POST /bot-api/messages` (e aspetto, meteo, conoscenza), inoltrato dall'api-gateway, autenticato con quel
 *   token (valido per UN bot in UNA location per 15 minuti). Pubblica la risposta come personaggio bot, nel flusso normale.
 *
 * L'inoltro parte da `server.ts` dopo la connessione a Redis (non da `onBoot`: i manifest si leggono prima che Redis esista).
 * Senza la configurazione completa non parte niente e `/bot-api` risponde 404. Servizio AI spento = nessuna risposta,
 * nessun errore per i giocatori.
 *
 * dependsOn: ['fineSessione'] — la risposta del bot entra nella
 * segmentazione in scene come ogni altro messaggio standard.
 * dependsOn: ['documenti'] — l'ambientazione pubblica che il bot può citare
 * (`searchPublicLore`, solo tipo `ambientazione`, solo pubblicata).
 */
export const botChat: FeatureManifest = {
  key: 'botChat',
  title: 'Bot chat',
  description: 'Chat dei bot con servizio AI esterno: inoltro degli eventi e API di risposta (/bot-api)',
  dependsOn: ['fineSessione', 'documenti'],
  routes: [
    { scope: 'public', path: '/bot-api', router: botApiRoutes, gated: false },
  ],
};
