import axios from 'axios';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('CallbackSender');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Comma-separated list of allowed callback hostnames.
 * If unset, defaults to localhost + host.docker.internal (local-only deployments).
 * Example: CALLBACK_ALLOWED_HOSTS=localhost,host.docker.internal,myserver.internal
 */
const ALLOWED_HOSTS: Set<string> = (() => {
  const raw = process.env.CALLBACK_ALLOWED_HOSTS || 'localhost,host.docker.internal,127.0.0.1,::1';
  return new Set(raw.split(',').map(h => h.trim().toLowerCase()).filter(Boolean));
})();

function isAllowedCallbackUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return ALLOWED_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

interface CallbackConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
}

export async function sendCallback(config: CallbackConfig, payload: any): Promise<boolean> {
  if (!isAllowedCallbackUrl(config.url)) {
    logger.error(`Callback URL rejected (host not in allowlist): ${config.url}`);
    return false;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios({
        method: config.method,
        url: config.url,
        data: payload,
        headers: config.headers,
        timeout: 10000,
      });

      logger.info(`Callback sent successfully`);
      return true;
    } catch (error: any) {
      logger.warn(`Callback attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  logger.error(`Callback failed after ${MAX_RETRIES + 1} attempts`);
  return false;
}
