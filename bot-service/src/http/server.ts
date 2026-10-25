import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { logger } from '../shared/logger';
import { buildHealthReport } from './health';
import type { AiService } from './service';

/** Il gateway tiene già i corpi sotto i 64 KB: qui un secondo limite, nel caso la porta fosse raggiunta in altro modo. */
const MAX_BODY_BYTES = 128 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('corpo troppo grande'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON non valido'), { status: 400 });
  }
}

/**
 * Server HTTP interno di bot-service. Ascolta SOLO su loopback per default: l'unico che lo raggiunge è
 * `ai-gateway` (che autentica). Espone `GET /health` e `POST /v1/<servizio>/<azione>` dei servizi attivi.
 */
export function createHttpServer(services: readonly AiService[]): Server {
  const byName = new Map(services.map((s) => [s.name, s]));

  return createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://internal');

        if (req.method === 'GET' && url.pathname === '/health') {
          const report = await buildHealthReport(services);
          send(res, report.services.length > 0 ? 200 : 503, report);
          return;
        }

        const match = /^\/v1\/([a-z-]+)\/([a-z-]+)$/.exec(url.pathname);
        if (req.method === 'POST' && match) {
          const handler = byName.get(match[1] as never)?.routes?.[match[2]!];
          // Servizio non attivo o azione inesistente: lo stesso 404 di una rotta che non c'è.
          if (!handler) return send(res, 404, { error: 'Non trovato' });
          const result = await handler(await readJson(req));
          return send(res, result.status, result.body);
        }

        send(res, 404, { error: 'Non trovato' });
      } catch (error: unknown) {
        const status = (error as { status?: number }).status ?? 500;
        if (status === 500) logger.error('Errore HTTP interno', { error: error instanceof Error ? error.message : String(error) });
        send(res, status, { error: status === 500 ? 'Errore interno' : (error as Error).message });
      }
    })();
  });
}
