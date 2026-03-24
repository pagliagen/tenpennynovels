import { IAgent } from './IAgent';
import { OllamaAgent } from './OllamaAgent';
import { AnthropicAgent } from './AnthropicAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('AgentFactory');

let _instance: IAgent | null = null;

/**
 * Returns the active LLM agent singleton.
 * Selection logic (in order of priority):
 *   1. ANTHROPIC_API_KEY set → AnthropicAgent
 *   2. fallback              → OllamaAgent
 */
export function getAgent(): IAgent {
  if (_instance) return _instance;

  if (process.env.ANTHROPIC_API_KEY) {
    logger.info(`Using AnthropicAgent (model: ${process.env.ANTHROPIC_MODEL || 'default'})`);
    _instance = new AnthropicAgent();
  } else {
    logger.info(`Using OllamaAgent (model: ${process.env.OLLAMA_MODEL || 'default'})`);
    _instance = new OllamaAgent();
  }

  return _instance;
}

export type { IAgent };
