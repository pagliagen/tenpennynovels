import { z } from 'zod';

const MAX_SYSTEM_CHARS = 8_000;
const MAX_USER_CHARS = 20_000;
const MAX_SCHEMA_CHARS = 8_000;

/**
 * Cosa accetta `POST /v1/editorial/generate`. Nessun campo per scegliere il modello né per
 * parametri di sistema di Ollama: il client chiede un testo, non configura la macchina.
 */
export const generateRequestSchema = z.object({
  system: z.string().min(1).max(MAX_SYSTEM_CHARS),
  user: z.string().min(1).max(MAX_USER_CHARS),
  /** JSON Schema per l'output vincolato; si limita la dimensione perché è un oggetto libero. */
  schema: z.record(z.string(), z.unknown()).refine((s) => JSON.stringify(s).length <= MAX_SCHEMA_CHARS, 'schema troppo grande').optional(),
  maxTokens: z.number().int().min(16).optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/** Il tetto vale sempre: chiedere più token del tetto non è un errore, si limita. */
export function clampTokens(requested: number | undefined, cap: number, fallback = 600): number {
  return Math.min(requested ?? Math.min(fallback, cap), cap);
}
