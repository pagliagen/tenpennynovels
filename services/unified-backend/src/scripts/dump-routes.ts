/**
 * Inventario delle route montate su `app`, senza avviare il server.
 *
 * Serve come rete di sicurezza durante il refactor "layer → feature":
 * a ogni fase si rigenera l'output e si verifica un diff vuoto contro
 * docs/refactor/routes-baseline.txt. Se qualcosa cambia, è un bug.
 *
 * Perché il monkeypatch: Express 5 (pacchetto `router` v2) non conserva
 * il path passato a `.use(path, subRouter)` come proprietà leggibile sul
 * Layer — lo risolve solo internamente in un matcher-closure. L'unico modo
 * di recuperarlo senza duplicare a mano l'albero delle route è intercettare
 * la chiamata originale e taggare i Layer appena creati con il path usato.
 * Le route dirette (`router.get/post/...`) non hanno questo problema: il
 * `Route` sottostante espone `.path` direttamente.
 *
 * Uso: npx tsx src/scripts/dump-routes.ts [> file]
 * NODE_ENV non impostato o 'development': appConfig fornisce default validi,
 * non serve un .env reale né una connessione a MongoDB/Redis (import-only,
 * app.ts non si connette a nulla: lo fa server.ts in startServer()).
 */

import RouterFactory from 'router';

/**
 * Forma minima delle parti interne del pacchetto `router` (v2, usato da
 * Express 5) che questo script legge. Non tipizzato a monte: niente
 * `@types/router` in npm, il pacchetto è scritto in JS puro. Le interfacce
 * qui sotto riflettono solo `node_modules/router/lib/{layer,route}.js`,
 * non l'intera superficie del pacchetto.
 */
interface RouterRoute {
  path: string;
  methods: Record<string, boolean | undefined>;
}

interface RouterHandle {
  stack?: RouterLayer[];
}

interface RouterLayer {
  route?: RouterRoute;
  handle?: RouterHandle;
  /** Taggato da patchRouterUse, non esiste nel pacchetto originale. */
  __mountPath?: string;
}

interface RouterInstance {
  stack: RouterLayer[];
  use: (...args: unknown[]) => RouterInstance;
}

function patchRouterUse(): void {
  const proto = (RouterFactory as unknown as { prototype: RouterInstance }).prototype;
  const originalUse = proto.use;

  proto.use = function patchedUse(this: RouterInstance, ...args: unknown[]): RouterInstance {
    const before = this.stack.length;
    const result = originalUse.apply(this, args);
    const mountPath = typeof args[0] === 'string' ? args[0] : '/';
    for (let i = before; i < this.stack.length; i++) {
      const layer = this.stack[i];
      if (layer) layer.__mountPath = mountPath;
    }
    return result;
  };
}

patchRouterUse();

interface RouteEntry {
  method: string;
  path: string;
}

function joinPaths(prefix: string, segment: string): string {
  if (segment === '/' || segment === '') return prefix === '' ? '/' : prefix;
  const left = prefix.replace(/\/+$/, '');
  const right = segment.replace(/^\/+/, '');
  return `${left}/${right}`;
}

function walk(router: RouterHandle | undefined, prefix: string, out: RouteEntry[]): void {
  const stack = router?.stack;
  if (!Array.isArray(stack)) return;

  for (const layer of stack) {
    if (layer.route) {
      const { path: routePath, methods } = layer.route;
      const fullPath = joinPaths(prefix, routePath);
      for (const method of Object.keys(methods)) {
        if (!methods[method]) continue;
        out.push({ method: method.toUpperCase(), path: fullPath });
      }
    } else if (layer.handle?.stack) {
      const mountPath = layer.__mountPath ?? '/';
      walk(layer.handle, joinPaths(prefix, mountPath), out);
    }
  }
}

/**
 * Importare app.ts inizializza servizi che loggano su Winston (che scrive
 * su stdout) come side-effect — CRON, ChatMessageService, AIGatewayClient...
 * Va zittito per non inquinare l'inventario, ma solo durante l'import: se
 * l'import lancia un errore, deve restare visibile.
 */
async function loadApp() {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    const { default: app } = await import('../app');
    return app;
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

interface ExpressAppInternals {
  /** Express 5 espone il router su `.router`; `._router` resta per compatibilità con codice scritto per Express 4. */
  router?: RouterHandle;
  _router?: RouterHandle;
}

async function main(): Promise<void> {
  const app = await loadApp();
  const internals = app as unknown as ExpressAppInternals;
  const router = internals.router ?? internals._router;

  const routes: RouteEntry[] = [];
  walk(router, '', routes);

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { method, path } of routes) {
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(key);
  }

  lines.sort();
  process.stdout.write(lines.join('\n') + '\n');

  // Il processo resta vivo per cron/timer avviati come side-effect
  // dell'import di app.ts (es. SessionCleanupJob). Non è un hang: è
  // lavoro di scripting one-shot, quindi si esce esplicitamente.
  process.exit(0);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[dump-routes] fallito:', error);
  process.exit(1);
});
