import { logger } from '@shared/utils/logger';

/**
 * Client del gateway AI (`ai-gateway/`): l'unico punto da cui il gioco parla con l'AI fuori dal
 * server di gioco. Oggi l'URL è un tunnel ngrok verso il Mac, domani un server dedicato: il client
 * non sa niente di ngrok, è solo un URL con un segreto.
 *
 * Due compiti:
 * - **sapere se un servizio AI è davvero attivo** (`isAvailable`): una sonda a `GET /health`, pigra
 *   (parte solo quando qualcuno chiede, mai da un timer: il piano gratuito di ngrok ha una quota di
 *   richieste), con cache, una sola sonda in volo e risposta VALIDATA (200 con un JSON `services`; la
 *   pagina 404 di ngrok a tunnel spento, o una pagina intermedia, non contano);
 * - **chiamare un servizio** (`generate`): errori sempre in italiano e generici, il dettaglio solo nei log.
 *
 * Fail-closed: qualunque dubbio (non configurato, timeout, 401, forma inattesa) = servizio non attivo.
 */

export interface AiGatewayOptions {
  url?: string | undefined;
  secret?: string | undefined;
  /** Quanto vale una sonda andata bene / fallita. */
  okTtlMs: number;
  failTtlMs: number;
  probeTimeoutMs: number;
  generateTimeoutMs: number;
  /** Sostituibili nei test. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export const DEFAULT_AI_GATEWAY_OPTIONS = {
  okTtlMs: 60_000,
  failTtlMs: 10_000,
  probeTimeoutMs: 3_000,
  generateTimeoutMs: 120_000,
} as const;

/** Errore da mostrare a un admin: il messaggio è già in italiano e senza dettagli tecnici. */
export class AiGatewayError extends Error {
  constructor(readonly userMessage: string, readonly status: number, readonly code?: string) {
    super(userMessage);
  }
}

export interface GenerateRequest {
  system: string;
  user: string;
  /** JSON Schema per l'output vincolato. */
  schema?: Record<string, unknown>;
  maxTokens?: number;
}

export interface GenerateResult {
  text?: string;
  json?: unknown;
  ms: number;
}

interface Snapshot {
  at: number;
  ok: boolean;
  services: readonly string[];
}

export class AiGatewayClient {
  private snapshot: Snapshot | null = null;
  private inFlight: Promise<Snapshot> | null = null;
  private lastState: boolean | null = null;
  private warnedUnconfigured = false;

  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: AiGatewayOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  isConfigured(): boolean {
    return !!this.options.url && !!this.options.secret;
  }

  /** `true` solo se il gateway risponde 200 e il servizio è fra quelli attivi e sani. */
  async isAvailable(service: string): Promise<boolean> {
    if (!this.isConfigured()) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        logger.warn('[AiGateway] AI abilitata ma AI_GATEWAY_URL / AI_GATEWAY_SECRET non sono impostati: funzioni AI spente');
      }
      return false;
    }
    const snapshot = await this.currentSnapshot();
    return snapshot.ok && snapshot.services.includes(service);
  }

  async generate(service: string, request: GenerateRequest): Promise<GenerateResult> {
    if (!this.isConfigured()) throw new AiGatewayError('Servizio AI non configurato.', 503);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint(`/v1/${service}/generate`), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.options.generateTimeoutMs),
      });
    } catch (error: unknown) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      logger.warn('[AiGateway] generate non riuscita', { service, reason: timedOut ? 'timeout' : 'rete' });
      this.invalidate();
      throw new AiGatewayError(timedOut ? 'Il servizio AI ha impiegato troppo tempo.' : 'Servizio AI non raggiungibile.', timedOut ? 504 : 503);
    }

    if (!response.ok) {
      logger.warn('[AiGateway] generate rifiutata', { service, status: response.status });
      if (response.status === 429) throw new AiGatewayError('Il servizio AI è occupato: riprova fra poco.', 429);
      if (response.status === 401) this.invalidate();
      throw new AiGatewayError('Il servizio AI non è disponibile.', 503);
    }

    try {
      return (await response.json()) as GenerateResult;
    } catch {
      throw new AiGatewayError('Risposta del servizio AI non valida.', 502);
    }
  }

  /**
   * Chiama un'azione di un servizio (`POST /v1/<servizio>/<azione>`) e restituisce il JSON.
   * Come `generate`: errori in italiano e generici. Fanno eccezione 400/409/429 dei servizi, i cui messaggi sono
   * scritti per essere letti da una persona (es. «Questa location ha già un bot») e passano con il loro `code`.
   */
  async call<T = unknown>(service: string, action: string, body: unknown, options: { timeoutMs?: number } = {}): Promise<T> {
    if (!this.isConfigured()) throw new AiGatewayError('Servizio AI non configurato.', 503);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint(`/v1/${service}/${action}`), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.options.generateTimeoutMs),
      });
    } catch (error: unknown) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      logger.warn('[AiGateway] call non riuscita', { service, action, reason: timedOut ? 'timeout' : 'rete' });
      this.invalidate();
      throw new AiGatewayError(timedOut ? 'Il servizio AI ha impiegato troppo tempo.' : 'Servizio AI non raggiungibile.', timedOut ? 504 : 503);
    }

    if (!response.ok) {
      logger.warn('[AiGateway] call rifiutata', { service, action, status: response.status });
      if (response.status === 401) this.invalidate();
      if ([400, 409, 429].includes(response.status)) {
        const detail = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
        if (typeof detail?.error === 'string') throw new AiGatewayError(detail.error, response.status, typeof detail.code === 'string' ? detail.code : undefined);
      }
      throw new AiGatewayError('Il servizio AI non è disponibile.', 503);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AiGatewayError('Risposta del servizio AI non valida.', 502);
    }
  }

  /** Dimentica l'ultima sonda: la prossima richiesta ricontrolla. */
  invalidate(): void {
    this.snapshot = null;
  }

  private endpoint(pathname: string): URL {
    return new URL(pathname, this.options.url);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'X-AI-Gateway-Secret': this.options.secret ?? '',
      // Il piano gratuito di ngrok può servire una pagina di avviso ai client che sembrano browser.
      'ngrok-skip-browser-warning': '1',
      ...extra,
    };
  }

  private async currentSnapshot(): Promise<Snapshot> {
    const s = this.snapshot;
    if (s && this.now() - s.at < (s.ok ? this.options.okTtlMs : this.options.failTtlMs)) return s;
    // Una sola sonda in volo: dieci richieste insieme non fanno dieci chiamate al tunnel.
    this.inFlight ??= this.probe().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async probe(): Promise<Snapshot> {
    let ok = false;
    let services: string[] = [];
    try {
      const response = await this.fetchImpl(this.endpoint('/health'), {
        headers: this.headers(),
        signal: AbortSignal.timeout(this.options.probeTimeoutMs),
      });
      if (response.status === 200) {
        const body = (await response.json()) as { services?: unknown };
        if (Array.isArray(body.services) && body.services.every((x) => typeof x === 'string')) {
          ok = true;
          services = body.services as string[];
        }
      }
    } catch {
      // timeout, rete, JSON non valido (es. la pagina HTML di ngrok): tutto uguale, servizio non attivo
    }

    const snapshot: Snapshot = { at: this.now(), ok, services };
    this.snapshot = snapshot;
    if (this.lastState !== ok) {
      logger.info(`[AiGateway] gateway ${ok ? 'raggiungibile' : 'non raggiungibile'}`, { services });
      this.lastState = ok;
    }
    return snapshot;
  }
}
