import { forward } from './upstream';

export interface HealthBody {
  services: string[];
  down: { name: string; reason: string }[];
}

const HEALTH_TIMEOUT_MS = 5000;

/**
 * Aggrega l'health: i servizi ATTIVI sono quelli abilitati e sani secondo bot-service. Se bot-service
 * non risponde, o risponde qualcosa di inatteso, nessun servizio è attivo (503). La risposta contiene
 * solo `services` e `down`: niente altro dell'upstream arriva fuori.
 */
export async function aggregateHealth(botServiceUrl: string): Promise<{ status: number; body: HealthBody }> {
  const down = (reason: string): { status: number; body: HealthBody } => ({ status: 503, body: { services: [], down: [{ name: 'bot-service', reason }] } });

  let raw: { status: number; body: string };
  try {
    raw = await forward(botServiceUrl, '/health', 'GET', null, HEALTH_TIMEOUT_MS);
  } catch {
    return down('non raggiungibile');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.body);
  } catch {
    return down('risposta non valida');
  }
  const p = parsed as { services?: unknown; down?: unknown };
  if (!Array.isArray(p.services) || !p.services.every((s) => typeof s === 'string')) return down('risposta non valida');

  const downList = Array.isArray(p.down)
    ? p.down.flatMap((d: unknown) => {
        const item = d as { name?: unknown; reason?: unknown };
        return typeof item.name === 'string' ? [{ name: item.name, reason: typeof item.reason === 'string' ? item.reason.slice(0, 120) : 'non sano' }] : [];
      })
    : [];
  const services = p.services as string[];
  return { status: services.length > 0 ? 200 : 503, body: { services, down: downList } };
}
