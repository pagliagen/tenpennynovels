import { z } from 'zod';

const schema = z.object({
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:12b'),
  /** Il modello lo sceglie il servizio, mai la richiesta. Se manca vale OLLAMA_MODEL. */
  EDITORIAL_MODEL: z.string().optional(),
  /** Richieste in attesa oltre a quella in corso: oltre, 429. */
  EDITORIAL_MAX_QUEUE: z.coerce.number().int().min(0).max(50).default(4),
  /** Tetto di token generati per richiesta, qualunque cosa chieda il client. */
  EDITORIAL_MAX_TOKENS: z.coerce.number().int().min(16).max(4000).default(1200),
});

export interface EditorialConfig {
  ollamaUrl: string;
  model: string;
  maxQueue: number;
  maxTokens: number;
}

export function loadEditorialConfig(env: NodeJS.ProcessEnv = process.env): EditorialConfig {
  const e = schema.parse(env);
  return { ollamaUrl: e.OLLAMA_URL, model: e.EDITORIAL_MODEL ?? e.OLLAMA_MODEL, maxQueue: e.EDITORIAL_MAX_QUEUE, maxTokens: e.EDITORIAL_MAX_TOKENS };
}
