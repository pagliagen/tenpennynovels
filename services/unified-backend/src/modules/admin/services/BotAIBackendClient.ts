import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

/**
 * Response types matching botai-backend patterns
 */
interface BotAIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

/**
 * Bot types (matching botai-backend models)
 */
interface Bot {
  _id: string;
  botCharacterId: string;
  name: string;
  gender?: string;
  personality: {
    traits: string[];
    coreValues: string[];
    speechPattern: string;
    emotionalRange: { min: number; max: number };
  };
  goals: {
    shortTerm: string[];
    longTerm: string[];
  };
  currentEmotionalState: {
    mood: string;
    intensity: number;
    lastUpdated: Date;
  };
  activationRules: {
    keywords: string[];
    contextualRelevance: number;
    cooldownMinutes: number;
  };
  assignedLocations: string[];
  tags?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateBotPayload {
  name: string;
  surname?: string;
  physicalDescription?: string;
  publicDescription?: string;
  privateDescription?: string;
  background?: any;
  personality: {
    traits: string[];
    coreValues: string[];
    speechPattern: string;
    emotionalRange?: { min: number; max: number };
  };
  goals: {
    shortTerm: string[];
    longTerm: string[];
  };
  activationRules?: {
    keywords?: string[];
    contextualRelevance?: number;
    cooldownMinutes?: number;
  };
  stats?: any;
  gender?: string;
}

interface GenerateBotPayload {
  locationId: string;
  description: string;
  tags?: string[];
}

interface UpdateBotPayload {
  name?: string;
  personality?: Partial<Bot['personality']>;
  goals?: Partial<Bot['goals']>;
  activationRules?: Partial<Bot['activationRules']>;
  tags?: string[];
  isActive?: boolean;
}

interface UpdateEmotionalStatePayload {
  mood: string;
  intensity: number;
}

interface AssignLocationsPayload {
  locationIds: string[];
}

/**
 * Client for BotAI Backend API
 * Handles all bot management operations via HTTP
 */
export class BotAIBackendClient {
  private readonly botaiBackendUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number = 15000; // 15 seconds (bot generation can be slow)

  constructor() {
    this.botaiBackendUrl = process.env.BOTAI_BACKEND_URL || 'http://localhost:8080';
    this.apiKey = process.env.BOTAI_BACKEND_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('[BotAIClient] BOTAI_BACKEND_API_KEY not configured - bot operations will fail');
    }

    logger.info('[BotAIClient] Initialized', {
      url: this.botaiBackendUrl,
      hasApiKey: !!this.apiKey
    });
  }

  /**
   * Make authenticated request to BotAI backend
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<BotAIResponse<T>> {
    const url = `${this.botaiBackendUrl}${endpoint}`;

    try {
      logger.debug(`[BotAIClient] ${method} ${endpoint}`, { data });

      const response = await axios({
        method,
        url,
        data,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': this.apiKey
        }
      });

      logger.info(`[BotAIClient] ${method} ${endpoint} - Success`, {
        status: response.status,
        dataKeys: response.data?.data ? Object.keys(response.data.data) : []
      });

      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message
      };

    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[BotAIClient] ${method} ${endpoint} - Failed`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: error.response?.data?.error || error.message,
          code: error.response?.data?.code
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message,
          code: error.response?.data?.code || `HTTP_${error.response?.status || 'ERROR'}`
        };
      }

      logger.error(`[BotAIClient] ${method} ${endpoint} - Unexpected error`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
        code: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * POST /bots - Create new bot
   */
  async createBot(payload: CreateBotPayload): Promise<BotAIResponse<{ botId: string; characterId: string; name: string }>> {
    return this.request('POST', '/bots', payload);
  }

  /**
   * POST /bots/generate - Auto-generate bot with AI
   */
  async generateBot(payload: GenerateBotPayload): Promise<BotAIResponse<{
    botId: string;
    characterId: string;
    name: string;
    locationId: string;
    generatedDetails: any;
  }>> {
    return this.request('POST', '/bots/generate', payload);
  }

  /**
   * GET /bots - Get all bots
   */
  async getBots(): Promise<BotAIResponse<Bot[]>> {
    return this.request('GET', '/bots');
  }

  /**
   * GET /bots/:botId - Get bot by ID
   */
  async getBot(botId: string): Promise<BotAIResponse<Bot>> {
    return this.request('GET', `/bots/${botId}`);
  }

  /**
   * PUT /bots/:botId - Update bot
   */
  async updateBot(botId: string, payload: UpdateBotPayload): Promise<BotAIResponse<Bot>> {
    return this.request('PUT', `/bots/${botId}`, payload);
  }

  /**
   * DELETE /bots/:botId - Delete bot (soft delete)
   */
  async deleteBot(botId: string): Promise<BotAIResponse<void>> {
    return this.request('DELETE', `/bots/${botId}`);
  }

  /**
   * POST /bots/:botId/activate - Activate bot
   */
  async activateBot(botId: string): Promise<BotAIResponse<Bot>> {
    return this.request('POST', `/bots/${botId}/activate`);
  }

  /**
   * PATCH /bots/:botId/emotional-state - Update emotional state
   */
  async updateEmotionalState(
    botId: string,
    payload: UpdateEmotionalStatePayload
  ): Promise<BotAIResponse<Bot['currentEmotionalState']>> {
    return this.request('PATCH', `/bots/${botId}/emotional-state`, payload);
  }

  /**
   * POST /bots/:botId/assign-locations - Assign locations to bot
   */
  async assignLocations(botId: string, payload: AssignLocationsPayload): Promise<BotAIResponse<Bot>> {
    return this.request('POST', `/bots/${botId}/assign-locations`, payload);
  }

  /**
   * DELETE /bots/:botId/unassign-locations - Unassign locations from bot
   */
  async unassignLocations(botId: string, payload: AssignLocationsPayload): Promise<BotAIResponse<Bot>> {
    return this.request('DELETE', `/bots/${botId}/unassign-locations`, payload);
  }

  /**
   * GET /bots/:botId/locations - Get bot's assigned locations
   */
  async getBotLocations(botId: string): Promise<BotAIResponse<{
    botId: string;
    name: string;
    assignedLocations: string[];
    count: number;
  }>> {
    return this.request('GET', `/bots/${botId}/locations`);
  }

  /**
   * GET /locations/:locationId/bots - Get bots assigned to location
   */
  async getLocationBots(locationId: string): Promise<BotAIResponse<{
    locationId: string;
    bots: Bot[];
    count: number;
  }>> {
    return this.request('GET', `/locations/${locationId}/bots`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.botaiBackendUrl}/health`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const botAIBackendClient = new BotAIBackendClient();
