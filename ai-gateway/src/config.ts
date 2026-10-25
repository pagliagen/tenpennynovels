import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  /** Loopback per default: ngrok (o nginx/Caddy sul server dedicato) gira sulla stessa macchina. */
  HOST: z.string().default('127.0.0.1'),
  /** Segreto condiviso col server di gioco (AI_GATEWAY_SECRET): `openssl rand -hex 32`. Obbligatorio, mai di default. */
  GATEWAY_SECRET: z.string().min(32, 'GATEWAY_SECRET mancante o troppo corto (min 32 caratteri)'),
  BOT_SERVICE_URL: z.string().url().default('http://127.0.0.1:8788'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(30),
  MAX_BODY_BYTES: z.coerce.number().int().min(1024).max(1_048_576).default(64 * 1024),
  /** Deve superare il timeout di generazione dei servizi (3 minuti nel client Ollama non vale: il tetto lo fa il gateway). */
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(125_000),
});

export interface GatewayConfig {
  port: number;
  host: string;
  secret: string;
  botServiceUrl: string;
  rateLimitPerMinute: number;
  maxBodyBytes: number;
  upstreamTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const e = schema.parse(env);
  return {
    port: e.PORT,
    host: e.HOST,
    secret: e.GATEWAY_SECRET,
    botServiceUrl: e.BOT_SERVICE_URL,
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    maxBodyBytes: e.MAX_BODY_BYTES,
    upstreamTimeoutMs: e.UPSTREAM_TIMEOUT_MS,
  };
}
