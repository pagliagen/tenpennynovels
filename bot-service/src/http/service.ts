/**
 * Un servizio AI ospitato da bot-service. Ogni servizio vive nella sua cartella
 * (`editorial/`, `character-bot/`) e il launcher (`src/index.ts`) avvia solo quelli
 * elencati in `ENABLED_SERVICES`.
 */

export const SERVICE_NAMES = ['editorial', 'character-bot'] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface ServiceHealth {
  ok: boolean;
  /** Perché non è sano, in poche parole: finisce in `/health`, mai prompt né risposte. */
  reason?: string;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

/** Gestore di `POST /v1/<servizio>/<azione>`: riceve il JSON già letto e validato nelle dimensioni. */
export type RouteHandler = (body: unknown) => Promise<RouteResult>;

export interface AiService {
  readonly name: ServiceName;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<ServiceHealth>;
  /** Azioni esposte via HTTP (assente = il servizio non ha rotte, come il character-bot). */
  readonly routes?: Readonly<Record<string, RouteHandler>>;
}

/** `ENABLED_SERVICES=editorial,character-bot`: vuoto = niente attivo. Un nome sconosciuto è un errore. */
export function parseEnabledServices(raw: string | undefined): ServiceName[] {
  const names = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((n) => !(SERVICE_NAMES as readonly string[]).includes(n));
  if (unknown.length > 0) {
    throw new Error(`ENABLED_SERVICES: servizio sconosciuto «${unknown.join(', ')}» (validi: ${SERVICE_NAMES.join(', ')})`);
  }
  return [...new Set(names)] as ServiceName[];
}
