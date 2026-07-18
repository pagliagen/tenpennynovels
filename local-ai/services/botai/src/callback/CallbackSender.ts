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

/**
 * Invia un evento di progresso senza retry (fire-and-forget).
 * Non blocca il flusso in caso di errore.
 */
export async function sendProgressCallback(config: CallbackConfig, requestId: string, message: string): Promise<void> {
  if (!isAllowedCallbackUrl(config.url)) return;

  let validatedUrl: URL;
  try {
    validatedUrl = new URL(config.url);
  } catch {
    return; // Invalid URL, skip callback
  }

  try {
    await axios({
      method: config.method,
      url: validatedUrl.href,
      data: { requestId, type: 'progress', message },
      headers: config.headers,
      timeout: 5000,
    });
  } catch {
    // progress callback failures are non-blocking
  }
}

export async function sendCallback(config: CallbackConfig, payload: any): Promise<boolean> {
  // Validate URL format and host to prevent SSRF attacks
  if (!isAllowedCallbackUrl(config.url)) {
    logger.error(`Callback URL rejected (host not in allowlist): ${config.url}`);
    return false;
  }

  let validatedUrl: URL;
  try {
    validatedUrl = new URL(config.url);
  } catch (error) {
    logger.error(`Callback URL is malformed: ${config.url}`);
    return false;
  }

  logger.info(`Sending callback to ${validatedUrl.href}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios({
        method: config.method,
        url: validatedUrl.href,
        data: payload,
        headers: config.headers,
        timeout: 10000,
      });

      logger.info(`Callback sent successfully (status: ${response.status})`);
      return true;
    } catch (error: any) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data)?.slice(0, 200);
      const code = error.code;
      logger.warn(`Callback attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: msg="${error.message}" code=${code} status=${status} body=${body}`);

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  logger.error(`Callback failed after ${MAX_RETRIES + 1} attempts`);
  return false;
}
