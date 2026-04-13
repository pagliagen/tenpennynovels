import { createApp } from './app';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGen');
const PORT = parseInt(process.env.CHAR_GEN_PORT as string, 10) || 8130;

function resolveProviderLabel(): string {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'inception') return `Inception API — model: ${process.env.INCEPTION_MODEL || 'mercury-2'}`;
  if (p === 'anthropic') return `Anthropic API — model: ${process.env.ANTHROPIC_MODEL || 'claude-haiku'}`;
  if (process.env.ANTHROPIC_API_KEY) return `Anthropic API — model: ${process.env.ANTHROPIC_MODEL || 'claude-haiku'}`;
  return 'Ollama (local)';
}

async function start() {
  const app = createApp();

  app.listen(PORT, () => {
    logger.info(`CharacterGen service listening on port ${PORT}`);
    logger.info(`Using ${resolveProviderLabel()}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
