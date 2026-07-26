import { IAgent } from './IAgent';
import { OllamaAgent } from './OllamaAgent';
import { InceptionAgent } from './InceptionAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('AgentFactory');

let _creativeAgent: IAgent | null = null;
let _analyticalAgent: IAgent | null = null;

type AIProvider = 'inception' | 'ollama';

/**
 * Resolves the active provider from AI_PROVIDER env var. Defaults to ollama (LLM locale).
 */
export function resolveProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'inception' || explicit === 'ollama') {
    return explicit;
  }
  return 'ollama';
}

function createAgent(role: string): IAgent {
  const provider = resolveProvider();

  switch (provider) {
    case 'inception': {
      logger.info(`[${role}] Using InceptionAgent (model: ${process.env.INCEPTION_MODEL || 'mercury-2'})`);
      return new InceptionAgent();
    }
    default: {
      const model = role === 'Analytical'
        ? (process.env.OLLAMA_ANALYTICAL_MODEL || process.env.OLLAMA_MODEL || 'qwen3:8b')
        : (process.env.OLLAMA_MODEL || 'hermes3:8b');
      logger.info(`[${role}] Using OllamaAgent (model: ${model})`);
      return new OllamaAgent(model);
    }
  }
}

/**
 * Returns the creative LLM agent (dialogue generation, arc summaries, bot creation).
 */
export function getCreativeAgent(): IAgent {
  if (_creativeAgent) return _creativeAgent;
  _creativeAgent = createAgent('Creative');
  return _creativeAgent;
}

/**
 * Returns the analytical LLM agent (post-analysis, structured JSON extraction).
 */
export function getAnalyticalAgent(): IAgent {
  if (_analyticalAgent) return _analyticalAgent;
  _analyticalAgent = createAgent('Analytical');
  return _analyticalAgent;
}

/**
 * @deprecated Use getCreativeAgent() instead.
 */
export function getAgent(): IAgent {
  return getCreativeAgent();
}

export type { IAgent };
