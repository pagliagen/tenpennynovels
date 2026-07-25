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

interface BotRespondPayload {
  requestId: string;
  bot: { id: string; name: string };
  context: {
    location: { id?: string; name: string; description?: string };
    triggeringAction: {
      id?: string;
      characterId?: string;
      characterName: string;
      content: string;
      type?: string;
    };
    recentActions?: Array<{
      characterId?: string;
      characterName: string;
      content: string;
      timestamp?: string;
    }>;
    presentCharacters?: Array<{ id?: string; name: string }>;
  };
  callback?: {
    url: string;
    method: 'POST';
    headers: Record<string, string>;
  };
}

interface ImageGenPayload {
  entityType: 'character' | 'item' | 'location';
  record: Record<string, any>;
  style?: string;
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg' | 'webp';
  };
  callback: {
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    headers: Record<string, string>;
  };
}

interface ImageGenResponse {
  success: boolean;
  jobId: string;
  status: string;
  queuePosition?: number;
}

export class AIGatewayClient {
  private config: AIGatewayConfig;
  private healthy: boolean | null = null;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL_MS = 60_000;

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

  async isHealthy(): Promise<boolean> {
    const now = Date.now();
    if (this.healthy !== null && now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL_MS) {
      return this.healthy;
    }

    try {
      const response = await axios.get(`${this.config.url}/health`, {
        timeout: 3000,
        headers: {
          'X-API-Key': this.config.apiKey,
          'X-Client-Id': this.config.clientId,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const status = response.data?.status;
      this.healthy = status === 'healthy';
    } catch {
      this.healthy = false;
    }

    this.lastHealthCheck = now;
    return this.healthy ?? false;
  }

  async notifyBotAction(payload: BotRespondPayload): Promise<boolean> {
    const result = await this.request('POST', '/botai/respond', payload);
    return result !== null;
  }

  async generateImage(payload: ImageGenPayload): Promise<ImageGenResponse | null> {
    return this.request<ImageGenResponse>('POST', '/image-gen/generate', payload);
  }

  async generateSeoDescription(title: string, content: string): Promise<string | null> {
    const result = await this.request<{ success: boolean; description: string }>('POST', '/seo/generate-description', { title, content });
    if (result?.success && result.description) return result.description;
    return null;
  }

  async createBot(data: any) { return this.request('POST', '/botai/bots', data); }
  // Timeout 120s — generazione sincrona LLM
  async generateBot(data: any) { return this.request('POST', '/botai/bots/generate', data, 120_000); }
  // Timeout 120s — refine AI-powered LLM
  async refineBot(id: string, data: any) { return this.request('POST', `/botai/bots/${id}/refine`, data, 120_000); }
  async getBots() { return this.request('GET', '/botai/bots'); }
  async getBot(id: string) { return this.request('GET', `/botai/bots/${id}`); }
  async updateBot(id: string, data: any) { return this.request('PUT', `/botai/bots/${id}`, data); }
  async deleteBot(id: string) { return this.request('DELETE', `/botai/bots/${id}`); }
  async getBotRelationships(id: string) { return this.request('GET', `/botai/bots/${id}/relationships`); }
  async getBotMemories(id: string, limit = 50) { return this.request('GET', `/botai/bots/${id}/memories?limit=${limit}`); }
  async getBotCharacterMemories(id: string, characterId: string, limit = 30) { return this.request('GET', `/botai/bots/${id}/memories/${characterId}?limit=${limit}`); }

  // Timeout 300s — generazione personaggio sincrona LLM (più lunga)
  async generateCharacter(data: any) { return this.request('POST', '/character-gen/generate', data, 300_000); }
}

export const aiGatewayClient = new AIGatewayClient();
