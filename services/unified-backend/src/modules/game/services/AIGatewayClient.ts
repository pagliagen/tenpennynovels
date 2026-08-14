import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { logger } from '../logger';
import { appConfig } from '@config/runtime';

interface AIGatewayConfig {
  url: string;
  clientId: string;
  apiKey: string;
  hmacSecret: string;
  timeout: number;
}

export class AIGatewayClient {
  private config: AIGatewayConfig;

  constructor() {
    const gw = appConfig.services.aiGateway;
    this.config = {
      url: gw.url || '',
      clientId: gw.clientId || '',
      apiKey: gw.apiKey || '',
      hmacSecret: gw.hmacSecret || '',
      timeout: 60_000,
    };

    if (!this.config.apiKey || !this.config.clientId) {
      logger.warn('[AIGateway] AI_GATEWAY_API_KEY o AI_GATEWAY_CLIENT_ID non configurati');
    }

    logger.info(`[AIGateway] Initialized: ${this.config.url} (client: ${this.config.clientId})`);
  }

  private signRequest(body: string): { signature: string; timestamp: string } {
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', this.config.hmacSecret)
      .update(timestamp + '.' + body)
      .digest('hex');
    return { signature, timestamp };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any,
    timeoutMs?: number,
  ): Promise<T | null> {
    const url = `${this.config.url}${path}`;
    const body = data ? JSON.stringify(data) : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-Client-Id': this.config.clientId,
    };

    if (this.config.hmacSecret) {
      const { signature, timestamp } = this.signRequest(body);
      headers['X-HMAC-Signature'] = signature;
      headers['X-HMAC-Timestamp'] = timestamp;
    }

    try {
      const response = await axios({
        method, url, data, headers,
        timeout: timeoutMs ?? this.config.timeout,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[AIGateway] ${method} ${path} failed`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
      } else {
        logger.error(`[AIGateway] ${method} ${path} unexpected error`, { error });
      }
      return null;
    }
  }

  async generateSeoDescription(title: string, content: string): Promise<string | null> {
    const result = await this.request<{ success: boolean; description: string }>('POST', '/seo/generate-description', { title, content });
    if (result?.success && result.description) return result.description;
    return null;
  }
}

export const aiGatewayClient = new AIGatewayClient();
