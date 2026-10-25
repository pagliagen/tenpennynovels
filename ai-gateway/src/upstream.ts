import { HttpError } from './limits';

export interface UpstreamResponse {
  status: number;
  body: string;
}

/**
 * Dove va una richiesta: `/health` oppure `/v1/<servizio>/<azione>` già risolti dal registro.
 * L'host viene sempre e solo dalla configurazione (`BOT_SERVICE_URL`): il client sceglie al più due segmenti di percorso.
 */
export type UpstreamTarget = { kind: 'health' } | { kind: 'route'; service: string; action: string };

export function upstreamUrl(baseUrl: string, target: UpstreamTarget): string {
  const base = baseUrl.replace(/\/+$/, '');
  return target.kind === 'health' ? `${base}/health` : `${base}/v1/${encodeURIComponent(target.service)}/${encodeURIComponent(target.action)}`;
}

/** Inoltra a bot-service. Errori di rete → 502, tempo scaduto → 504; mai dettagli verso il client. */
export async function forward(baseUrl: string, target: UpstreamTarget, method: 'GET' | 'POST', body: Buffer | null, timeoutMs: number): Promise<UpstreamResponse> {
  try {
    const response = await fetch(upstreamUrl(baseUrl, target), {
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
