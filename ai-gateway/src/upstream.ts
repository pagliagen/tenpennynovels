import { HttpError } from './limits';

export interface UpstreamResponse {
  status: number;
  body: string;
}

/** Inoltra a bot-service. Errori di rete → 502, tempo scaduto → 504; mai dettagli verso il client. */
export async function forward(baseUrl: string, pathname: string, method: 'GET' | 'POST', body: Buffer | null, timeoutMs: number): Promise<UpstreamResponse> {
  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: new Uint8Array(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, body: await response.text() };
  } catch (error: unknown) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new HttpError(timedOut ? 504 : 502, timedOut ? 'Il servizio ha impiegato troppo' : 'Servizio non raggiungibile');
  }
}
