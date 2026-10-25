/**
 * La chat dei bot si accende solo con TUTTA la configurazione al suo posto: un pezzo mancante = non parte niente
 * (né pubblicazione su Redis, né chiamate al servizio AI, né API di ritorno). Funzione pura, un solo punto.
 *
 * Il percorso: il gioco pubblica l'evento su Redis, `BotChatForwarder` lo spinge al servizio AI (gateway) insieme
 * all'indirizzo e a un token con cui rispondere, e il servizio AI risponde su `/bot-api`.
 */

export interface BotChatConfigStatus {
  /** `ENABLE_BOT_CHAT === 'true'`. Spenta è una scelta, non un errore: `missing` resta vuoto. */
  enabled: boolean;
  /** Variabili assenti o non valide (solo se la chat è abilitata). */
  missing: string[];
  /** Abilitata e completa: solo qui l'evento parte. */
  complete: boolean;
  /** L'indirizzo pubblico di questo backend a cui il servizio AI risponde (senza barra finale). */
  replyBaseUrl: string | null;
}

/** `localhost`, `127.0.0.1`, `::1`: gli unici indirizzi per cui `http` è lecito. */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function parseUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export const MIN_SECRET_CHARS = 32;

export function botChatConfigStatus(env: Readonly<Record<string, string | undefined>> = process.env): BotChatConfigStatus {
  const enabled = env.ENABLE_BOT_CHAT === 'true';
  if (!enabled) return { enabled: false, missing: [], complete: false, replyBaseUrl: null };

  const missing: string[] = [];
  if ((env.BOT_SERVICE_SECRET ?? '').length < MIN_SECRET_CHARS) missing.push(`BOT_SERVICE_SECRET (almeno ${MIN_SECRET_CHARS} caratteri)`);

  const reply = parseUrl(env.BOT_REPLY_BASE_URL);
  // `https` ovunque tranne in locale: il token viaggia in chiaro su http.
  if (!reply || (reply.protocol === 'http:' && !isLoopbackHost(reply.hostname))) missing.push('BOT_REPLY_BASE_URL (https, o http solo su localhost)');

  if (!parseUrl(env.AI_GATEWAY_URL)) missing.push('AI_GATEWAY_URL');
  if (!env.AI_GATEWAY_SECRET) missing.push('AI_GATEWAY_SECRET');

  return {
    enabled: true,
    missing,
    complete: missing.length === 0,
    replyBaseUrl: reply && missing.length === 0 ? reply.origin : null,
  };
}
