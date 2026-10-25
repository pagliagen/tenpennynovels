import { eventRequestSchema } from './events';
import { isPublicStandard, shouldTrigger } from './filters';
import { BackendClient } from './backendClient';
import { allowedReplyOrigin } from './reply';
import type { BotConfig } from './config';
import type { ReplyContext } from './responder';
import type { RouteHandler } from '../http/service';

/** Quanti `eventId` si ricordano per scartare un evento ricevuto due volte. */
export const SEEN_EVENTS = 500;

/** Ciò che il gestore dell'evento legge dallo stato del servizio. */
export interface IntakeState {
  /** Origin ammessi per la risposta (`ALLOWED_REPLY_ORIGINS`). */
  allowedReplyOrigins: readonly string[];
  /** `<ambiente>:<locationId>` → bot. Le location hanno gli stessi id in ogni ambiente: la chiave li distingue. */
  responders: ReadonlyMap<string, { bot: BotConfig; responder: { notify(ctx?: ReplyContext): void } }>;
  /** characterId dei bot per ambiente: nessun bot risponde a un bot. */
  botIds: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * `POST /v1/character-bot/event`: il gioco ha un messaggio pubblico in una location. Risponde subito (il lavoro vero,
 * lento, parte in coda): 202 se il bot ci pensa, 200 `accepted:false` se non tocca a lui, 400 se la richiesta o
 * l'indirizzo di risposta non vanno. Il token arriva con l'evento e si ripresenta solo a un origin ammesso.
 */
export function createEventHandler(
  getState: () => IntakeState | null,
  makeBackend: (origin: string, token: string) => ReplyContext['backend'] = (origin, token) => new BackendClient(origin, token),
): RouteHandler {
  const seen = new Set<string>();
  const remember = (eventId: string): boolean => {
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    if (seen.size > SEEN_EVENTS) seen.delete(seen.values().next().value as string);
    return true;
  };

  return async (body) => {
    const parsed = eventRequestSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: { error: 'Richiesta non valida' } };
    const state = getState();
    if (!state) return { status: 503, body: { error: 'Servizio non avviato' } };
    const { environment, locationId, event, history, reply } = parsed.data;

    const origin = allowedReplyOrigin(reply.baseUrl, state.allowedReplyOrigins);
    if (!origin) return { status: 400, body: { error: 'Indirizzo di risposta non ammesso', code: 'reply-not-allowed' } };

    const entry = state.responders.get(`${environment}:${locationId}`);
    if (!entry) return { status: 200, body: { accepted: false, reason: 'no-bot' } };
    if (!isPublicStandard(event) || !shouldTrigger(event, entry.bot, state.botIds.get(environment) ?? new Set())) {
      return { status: 200, body: { accepted: false, reason: 'not-triggered' } };
    }
    if (!remember(event.eventId)) return { status: 200, body: { accepted: false, reason: 'duplicate' } };

    entry.responder.notify({ history, backend: makeBackend(origin, reply.token) });
    return { status: 202, body: { accepted: true } };
  };
}
