/**
 * Registro dei servizi raggiungibili: il gateway NON è un proxy aperto. Passa solo
 * `POST /v1/<servizio>/<azione>` con servizio in questo elenco; tutto il resto è 404.
 * Aggiungere un servizio (o un upstream diverso da bot-service) significa registrarlo qui.
 */
export const SERVICES = ['editorial', 'character-bot'] as const;
export type ServiceName = (typeof SERVICES)[number];

const ROUTE = /^\/v1\/([a-z-]+)\/([a-z-]+)$/;

export function resolveRoute(pathname: string): { service: ServiceName; action: string } | null {
  const match = ROUTE.exec(pathname);
  if (!match) return null;
  const [, service, action] = match;
  return (SERVICES as readonly string[]).includes(service!) ? { service: service as ServiceName, action: action! } : null;
}
