import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

class ClaudeConfig {
  private static instance: ClaudeConfig;
  private client: Anthropic;
  private apiKey: string;
  private model: string;
  private translateModel: string;

  private constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
    this.translateModel = process.env.TRANSLATE_MODEL || 'claude-sonnet-4-5-20250929';

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey: this.apiKey
    });

    logger.info(`Claude SDK initialized with model: ${this.model}`);
    logger.info(`Translation model: ${this.translateModel}`);
  }

  public static getInstance(): ClaudeConfig {
    if (!ClaudeConfig.instance) {
      ClaudeConfig.instance = new ClaudeConfig();
    }
    return ClaudeConfig.instance;
  }

  public getClient(): Anthropic {
    return this.client;
  }

  public getModel(): string {
    return this.model;
  }

  public getTranslateModel(): string {
    return this.translateModel;
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Simple test to verify API key works
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Test'
          }
        ]
      });

      logger.info('✅ Claude API connection test successful');
      return true;
    } catch (error: any) {
      logger.error('❌ Claude API connection test failed:', error.message);
      return false;
    }
  }
}

export const claudeConfig = ClaudeConfig.getInstance();
