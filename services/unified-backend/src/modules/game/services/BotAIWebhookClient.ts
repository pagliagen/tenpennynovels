import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

export class BotAIWebhookClient {
  private readonly botaiUrl: string;
  private readonly timeout: number = 5000; // 5 seconds timeout
  private readonly environment: string;

  constructor() {
    this.botaiUrl = process.env.BOTAI_WEBHOOK_URL || 'http://localhost:8080';
    // Determine environment based on NODE_ENV
    this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    logger.info(`[BotAI] Webhook client initialized for ${this.environment} environment`);
  }

  /**
   * Notifica botai-backend di nuova azione in location con bot
   * In caso di errore (timeout, unreachable), ritorna false ma NON blocca il gioco
   */
  async notifyLocationAction(action: any, sessionId: string | undefined, isBotTurn: boolean = false): Promise<boolean> {
    try {
      logger.info(`[BotAI] Notifying botai-backend at ${this.botaiUrl}/sync/action`);
      logger.info(`[BotAI] Action: ${action._id}, Location: ${action.locationId}, Session: ${sessionId || 'none'}`);

      const payload = {
        eventType: 'location_action_created',
        timestamp: new Date().toISOString(),
        sessionId: sessionId || null, // Per disabilitare bot per questa sessione se fail
        data: {
          actionId: action._id.toString(),
          locationId: action.locationId,
          characterId: action.characterId,
          characterName: action.characterName,
          actionType: action.actionType,
          content: action.content,
          timestamp: action.timestamp,
          tags: action.tags || [],
          visibility: action.visibility,
          isBotTurn // Flag to indicate if bot should respond (it's bot turn)
        }
      };

      await axios.post(`${this.botaiUrl}/sync/action`, payload, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Environment': this.environment
        }
      });

      logger.info(`[BotAI] Action ${action._id} sent to botai successfully`);
      return true;

    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`[BotAI] Axios error calling botai-backend:`);
        logger.error(`[BotAI]   - Code: ${error.code}`);
        logger.error(`[BotAI]   - Message: ${error.message}`);
        logger.error(`[BotAI]   - URL: ${this.botaiUrl}/sync/action`);
        if (error.response) {
          logger.error(`[BotAI]   - Response Status: ${error.response.status}`);
          logger.error(`[BotAI]   - Response Data: ${JSON.stringify(error.response.data)}`);
        }
      } else {
        logger.error(`[BotAI] Unknown error calling botai-backend:`, error);
      }

      // NON bloccare il gioco, ritorna false per disabilitare bot
      return false;
    }
  }

  /**
   * Notifica aggiornamento personaggio (best effort, non critico)
   */
  async notifyCharacterUpdate(characterId: string, characterData: any): Promise<void> {
    try {
      const payload = {
        eventType: 'character_updated',
        timestamp: new Date().toISOString(),
        data: {
          characterId,
          ...characterData
        }
      };

      await axios.post(`${this.botaiUrl}/sync/character`, payload, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Environment': this.environment
        }
      });

      logger.debug(`[BotAI] Character ${characterId} update sent to botai`);

    } catch (error) {
      // Silently fail, non critico
      logger.debug(`[BotAI] Failed to sync character update (non-critical):`, error);
    }
  }
}

export const botaiWebhookClient = new BotAIWebhookClient();
