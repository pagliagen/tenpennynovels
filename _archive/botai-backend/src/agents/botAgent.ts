/**
 * Bot Agent - Claude SDK configuration and interface
 * This file provides the agent configuration for bot response generation
 *
 * The actual implementation is in ClaudeAgentService
 * This file serves as the public interface and configuration
 */

import { claudeAgentService, BotContext } from '../services/ClaudeAgentService';

export { BotContext };

/**
 * Generate bot response using Claude SDK
 *
 * @param context Bot context including personality, memories, and trigger
 * @returns Generated response text
 */
export async function generateBotResponse(context: BotContext): Promise<string> {
  return await claudeAgentService.generateBotResponse(context);
}

/**
 * Prepare bot context for response generation
 *
 * @param bot Bot document
 * @param locationData Location information
 * @param actionData Triggering action
 * @param presentCharacterIds IDs of characters in location
 * @returns Prepared bot context
 */
export async function prepareBotContext(
  bot: any,
  locationData: any,
  actionData: any,
  presentCharacterIds: string[]
): Promise<BotContext> {
  return await claudeAgentService.prepareBotContext(
    bot,
    locationData,
    actionData,
    presentCharacterIds
  );
}

/**
 * Bot agent configuration
 */
export const botAgentConfig = {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1024,
  temperature: 0.8,
  systemPromptTemplate: 'victorian-npc',
  responseStyle: 'conversational',
  maxResponseLength: 3 // sentences
};

export default {
  generateBotResponse,
  prepareBotContext,
  config: botAgentConfig
};
