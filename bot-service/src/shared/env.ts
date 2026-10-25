import 'dotenv/config';
import { z } from 'zod';
import { parseEnabledServices, type ServiceName } from '../http/service';

const schema = z.object({
  /** Porta dell'HTTP interno (loopback). */
  PORT: z.coerce.number().int().min(1).max(65535).default(8788),
  HOST: z.string().default('127.0.0.1'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:12b'),
  ENABLED_SERVICES: z.string().optional(),
});

export interface LauncherConfig {
  port: number;
  host: string;
  ollamaUrl: string;
  ollamaModel: string;
  enabled: ServiceName[];
}

export function loadLauncherConfig(env: NodeJS.ProcessEnv = process.env): LauncherConfig {
  const e = schema.parse(env);
  return { port: e.PORT, host: e.HOST, ollamaUrl: e.OLLAMA_URL, ollamaModel: e.OLLAMA_MODEL, enabled: parseEnabledServices(e.ENABLED_SERVICES) };
}
