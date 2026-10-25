import { createServer, type RequestListener, type Server, type ServerResponse } from 'node:http';
import { isAuthorized, SECRET_HEADER } from './auth';
import type { GatewayConfig } from './config';
import { aggregateHealth } from './health';
import { HttpError, RateLimiter, readBody } from './limits';
import { logger } from './logger';
import { resolveRoute } from './registry';
import { forward } from './upstream';

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

/**
 * Ingresso dei servizi AI. Ordine delle difese, e non è casuale:
 * 1. **segreto** (anche per `/health` e per i percorsi inesistenti: 401 uguale per tutti, non si scopre nulla);
 * 2. rate limit globale;
 * 3. registro dei servizi (non è un proxy aperto) e dimensione del corpo;
 * 4. inoltro a bot-service con timeout.
 * Nessun prompt né risposta nei log: solo metodo, percorso, esito e tempo.
 */
export function createGatewayHandler(config: GatewayConfig): RequestListener {
  const limiter = new RateLimiter(config.rateLimitPerMinute);

  return (req, res) => {
    void (async () => {
      const startedAt = Date.now();
      const method = req.method ?? 'GET';
      let pathname = '/';
      let status = 500;
      try {
        pathname = new URL(req.url ?? '/', 'http://gateway').pathname;

        if (!isAuthorized(req.headers[SECRET_HEADER], config.secret)) {
          status = 401;
          return send(res, 401, { error: 'Non autorizzato' });
        }
        if (!limiter.allow()) {
          status = 429;
          return send(res, 429, { error: 'Troppe richieste' });
        }

        if (method === 'GET' && pathname === '/health') {
          const health = await aggregateHealth(config.botServiceUrl);
          status = health.status;
          return send(res, health.status, health.body);
        }

        const route = method === 'POST' ? resolveRoute(pathname) : null;
        if (!route) {
          status = 404;
          return send(res, 404, { error: 'Non trovato' });
        }

        const body = await readBody(req, config.maxBodyBytes);
        const upstream = await forward(config.botServiceUrl, { kind: 'route', service: route.service, action: route.action }, 'POST', body, config.upstreamTimeoutMs);
        status = upstream.status;
        send(res, upstream.status, upstream.body);
      } catch (error: unknown) {
        status = error instanceof HttpError ? error.status : 500;
        send(res, status, { error: error instanceof HttpError ? error.message : 'Errore interno' });
      } finally {
        logger.info('request', { method, path: pathname, status, ms: Date.now() - startedAt });
      }
    })();
  };
}

export function createGatewayServer(config: GatewayConfig): Server {
  return createServer(createGatewayHandler(config));
}
