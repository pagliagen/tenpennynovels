/**
 * Un flag d'ambiente è acceso solo se vale esattamente `'true'` (fail-closed: `1`, `TRUE`,
 * `yes`, vuoto o assente restano spenti). Funzione pura per poterla testare senza Redis.
 */
export function isEnvFlagOn(envVar: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[envVar] === 'true';
}
