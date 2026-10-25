/**
 * Un flag d'ambiente è acceso solo se vale esattamente `'true'` (fail-closed: `1`, `TRUE`,
 * `yes`, vuoto o assente restano spenti). Funzione pura per poterla testare senza Redis.
 */
export function isEnvFlagOn(envVar: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[envVar] === 'true';
}

export interface EnvFlagSpecLike {
  envVar: string;
  requiresAiService?: string | undefined;
}

/**
 * Un flag d'ambiente con un servizio AI dietro è attivo solo se la variabile è `'true'` E il servizio
 * risponde. Con la variabile spenta NON si interroga il gateway (nessuna sonda, nessuna richiesta).
 */
export async function isEnvFlagActive(
  spec: EnvFlagSpecLike,
  isServiceAvailable: (service: string) => Promise<boolean>,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  if (!isEnvFlagOn(spec.envVar, env)) return false;
  if (!spec.requiresAiService) return true;
  return isServiceAvailable(spec.requiresAiService);
}
