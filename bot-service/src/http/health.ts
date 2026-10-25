import type { AiService, ServiceName } from './service';

export interface HealthReport {
  /** Solo i servizi abilitati E sani: è questa lista che decide se un servizio è davvero attivo. */
  services: ServiceName[];
  /** Abilitati ma non sani, con il motivo (per capire cosa non va, non per decidere). */
  down: { name: ServiceName; reason: string }[];
}

const HEALTH_TIMEOUT_MS = 4000;

async function safeHealth(service: AiService): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await Promise.race([
      service.health(),
      new Promise<{ ok: boolean; reason: string }>((resolve) => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), HEALTH_TIMEOUT_MS)),
    ]);
  } catch (error: unknown) {
    return { ok: false, reason: error instanceof Error ? error.message : 'errore' };
  }
}

export async function buildHealthReport(services: readonly AiService[]): Promise<HealthReport> {
  const checks = await Promise.all(services.map(async (s) => [s, await safeHealth(s)] as const));
  return {
    services: checks.filter(([, h]) => h.ok).map(([s]) => s.name),
    down: checks.filter(([, h]) => !h.ok).map(([s, h]) => ({ name: s.name, reason: h.reason ?? 'non sano' })),
  };
}
