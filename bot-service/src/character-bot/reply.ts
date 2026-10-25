import { z } from 'zod';

/**
 * Dove e con quale credenziale rispondere: lo decide il gioco e lo manda con ogni evento (`reply`). Il servizio è così
 * agnostico (nessun ambiente, nessun URL, nessun segreto di gioco in configurazione). In cambio **non si fida dell'indirizzo**:
 * un token si invia solo a un origin della lista `ALLOWED_REPLY_ORIGINS`, e `http` solo su loopback.
 */

export const replySchema = z.object({
  baseUrl: z.string().url().max(300),
  token: z.string().min(20).max(2000),
});

export type Reply = z.infer<typeof replySchema>;

export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

/** L'origin a cui rispondere, o `null` se l'indirizzo non è ammesso. */
export function allowedReplyOrigin(baseUrl: string, allowed: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHost(url.hostname))) return null;
  // Niente credenziali nell'URL né percorsi: i percorsi (`/bot-api/...`) li aggiunge il servizio.
  if (url.username || url.password || (url.pathname !== '/' && url.pathname !== '')) return null;
  return allowed.includes(url.origin) ? url.origin : null;
}
