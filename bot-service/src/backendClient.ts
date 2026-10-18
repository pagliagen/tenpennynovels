import { logger } from './logger';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

export class BackendClient {
  constructor(private readonly baseUrl: string, private readonly secret: string) {}

  /** Pubblica la risposta nella chat. Ritenta una volta su errore di rete o 5xx. */
  async postMessage(params: { characterId: string; locationId: string; content: string; position?: string }): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(new URL('/internal/bot-chat/messages', this.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Bot-Service-Secret': this.secret },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return true;

        const body = (await response.text()).slice(0, 200);
        logger.warn('Backend ha rifiutato il messaggio', { status: response.status, body, attempt });
        if (response.status < 500) return false;
      } catch (error: unknown) {
        logger.warn('Backend non raggiungibile', { error: String(error), attempt });
      }
    }
    return false;
  }
}
