import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { CompleteCharacterPayload } from '../types/CompleteCharacter';

export class GameBackendClient {
  private readonly gameBackendUrl: string;
  private readonly botApiKey: string;
  private readonly timeout: number = 10000; // 10 seconds

  constructor() {
    this.gameBackendUrl = process.env.GAME_BACKEND_URL || 'http://localhost:3000';
    this.botApiKey = process.env.GAME_BACKEND_BOT_API_KEY || '';

    if (!this.botApiKey) {
      throw new Error('GAME_BACKEND_BOT_API_KEY environment variable is required');
    }
  }

  /**
   * Post bot action to game-backend
   */
  async postBotAction(
    characterId: string,
    characterName: string,
    locationId: string,
    content: string,
    actionType: string = 'standard',
    tags: string = ''
  ): Promise<{ success: boolean; actionId?: string; error?: string }> {
    try {
      const payload = {
        characterId,
        characterName,
        locationId,
        content,
        actionType,
        tags
      };

      const response = await axios.post(
        `${this.gameBackendUrl}/game/locations/actions/bot`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'x-bot-api-key': this.botApiKey
          }
        }
      );

      logger.info(`[GameBackend] Bot action posted successfully: ${response.data.data?.actionId}`);

      return {
        success: true,
        actionId: response.data.data?.actionId
      };

    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[GameBackend] Failed to post bot action:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message
        };
      }

      logger.error(`[GameBackend] Unexpected error posting bot action:`, error);
      return {
        success: false,
        error: 'Unexpected error'
      };
    }
  }

  /**
   * Create bot character in game-backend
   */
  async createBotCharacter(
    name: string,
    surname: string,
    botId: string,
    physicalDescription?: string,
    publicDescription?: string,
    privateDescription?: string,
    background?: any,
    stats?: any,
    gender?: string
  ): Promise<{ success: boolean; characterId?: string; error?: string }> {
    try {
      const payload = {
        name,
        surname,
        bot_id: botId,
        physicalDescription,
        publicDescription,
        privateDescription,
        background,
        stats,
        gender
      };

      const response = await axios.post(
        `${this.gameBackendUrl}/game/characters/bot`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'x-bot-api-key': this.botApiKey
          }
        }
      );

      logger.info(`[GameBackend] Bot character created successfully: ${response.data.data?.characterId}`);

      return {
        success: true,
        characterId: response.data.data?.characterId
      };

    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[GameBackend] Failed to create bot character:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message
        };
      }

      logger.error(`[GameBackend] Unexpected error creating bot character:`, error);
      return {
        success: false,
        error: 'Unexpected error'
      };
    }
  }

  /**
   * Create COMPLETE bot character in game-backend
   * Includes full stats, skills, occupation, background, and demographics
   */
  async createCompleteBotCharacter(
    payload: CompleteCharacterPayload
  ): Promise<{ success: boolean; characterId?: string; error?: string }> {
    try {
      logger.info(`[GameBackend] Creating COMPLETE bot character: ${payload.name}`);
      logger.debug(`[GameBackend] Complete payload:`, {
        name: payload.name,
        statsTotal: Object.values(payload.stats).reduce((sum, val) => sum + val, 0),
        skillsCount: Object.keys(payload.skills).length,
        occupation: payload.occupation.name
      });

      const response = await axios.post(
        `${this.gameBackendUrl}/game/characters/bot/complete`,
        payload,
        {
          timeout: this.timeout * 2, // Double timeout for complete character creation
          headers: {
            'Content-Type': 'application/json',
            'x-bot-api-key': this.botApiKey
          }
        }
      );

      logger.info(`[GameBackend] Complete bot character created successfully: ${response.data.data?.characterId}`);

      return {
        success: true,
        characterId: response.data.data?.characterId
      };

    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[GameBackend] Failed to create complete bot character:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message
        };
      }

      logger.error(`[GameBackend] Unexpected error creating complete bot character:`, error);
      return {
        success: false,
        error: 'Unexpected error'
      };
    }
  }

  /**
   * Get location details (bot API)
   */
  async getLocationDetails(locationId: string): Promise<{
    success: boolean;
    location?: any;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.gameBackendUrl}/game/locations/${locationId}/bot-details`,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'x-bot-api-key': this.botApiKey
          }
        }
      );

      logger.info(`[GameBackend] Location details fetched: ${response.data.data?.name}`);

      return {
        success: true,
        location: response.data.data
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error('[GameBackend] Failed to fetch location details:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message
        };
      }

      logger.error('[GameBackend] Unexpected error fetching location details:', error);
      return {
        success: false,
        error: 'Unexpected error'
      };
    }
  }

  /**
   * Enable bot for location (bot API)
   */
  async enableBotForLocation(locationId: string, enabled: boolean = true): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.patch(
        `${this.gameBackendUrl}/game/locations/${locationId}/bot-enabled`,
        { bot_enabled: enabled },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'x-bot-api-key': this.botApiKey
          }
        }
      );

      logger.info(`[GameBackend] Bot ${enabled ? 'enabled' : 'disabled'} for location ${locationId}`);

      return { success: true };
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error('[GameBackend] Failed to update bot_enabled:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        return {
          success: false,
          error: error.response?.data?.error || error.message
        };
      }

      logger.error('[GameBackend] Unexpected error updating bot_enabled:', error);
      return {
        success: false,
        error: 'Unexpected error'
      };
    }
  }
}

export const gameBackendClient = new GameBackendClient();
