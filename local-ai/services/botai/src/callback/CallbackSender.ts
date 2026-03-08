import axios from 'axios';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('CallbackSender');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

interface CallbackConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
}

export async function sendCallback(config: CallbackConfig, payload: any): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios({
        method: config.method,
        url: config.url,
        data: payload,
        headers: config.headers,
        timeout: 10000,
      });

      logger.info(`Callback sent to ${config.url}`);
      return true;
    } catch (error: any) {
      logger.warn(`Callback attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  logger.error(`Callback failed after ${MAX_RETRIES + 1} attempts to ${config.url}`);
  return false;
}
