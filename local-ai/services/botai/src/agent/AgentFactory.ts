import { IAgent } from './IAgent';
import { OllamaAgent } from './OllamaAgent';
import { AnthropicAgent } from './AnthropicAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('AgentFactory');

let _creativeAgent: IAgent | null = null;
let _analyticalAgent: IAgent | null = null;

/**
 * Returns the creative LLM agent (dialogue generation, arc summaries, bot creation).
 * Uses Anthropic if ANTHROPIC_API_KEY is set, otherwise falls back to Ollama.
 */
export function getCreativeAgent(): IAgent {
  if (_creativeAgent) return _creativeAgent;

  if (process.env.ANTHROPIC_API_KEY) {
    logger.info(`[Creative] Using AnthropicAgent (model: ${process.env.ANTHROPIC_MODEL || 'default'})`);
    _creativeAgent = new AnthropicAgent();
  } else {
    logger.info(`[Creative] Using OllamaAgent (model: ${process.env.OLLAMA_MODEL || 'default'})`);
    _creativeAgent = new OllamaAgent();
  }

  return _creativeAgent;
}

/**
 * Returns the analytical LLM agent (post-analysis, structured JSON extraction).
 * Uses Anthropic if available (better at complex structured output), otherwise Ollama.
 */
export function getAnalyticalAgent(): IAgent {
  if (_analyticalAgent) return _analyticalAgent;

  if (process.env.ANTHROPIC_API_KEY) {
    logger.info(`[Analytical] Using AnthropicAgent (model: ${process.env.ANTHROPIC_MODEL || 'default'})`);
    _analyticalAgent = new AnthropicAgent();
  } else {
    logger.info(`[Analytical] Using OllamaAgent (model: ${process.env.OLLAMA_ANALYTICAL_MODEL || process.env.OLLAMA_MODEL || 'default'})`);
    _analyticalAgent = new OllamaAgent();
  }

  return _analyticalAgent;
}

/**
 * @deprecated Use getCreativeAgent() instead.
 */
export function getAgent(): IAgent {
  return getCreativeAgent();
}

export type { IAgent };
