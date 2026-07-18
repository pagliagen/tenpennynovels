import { createApp } from './app';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGen');
const PORT = parseInt(process.env.CHAR_GEN_PORT as string, 10) || 8130;

function resolveProviderLabel(): string {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'inception') return `Inception API — model: ${process.env.INCEPTION_MODEL || 'mercury-2'}`;
  const model = process.env.OLLAMA_ANALYTICAL_MODEL || process.env.OLLAMA_MODEL || 'qwen3:8b';
  return `Ollama (local) — model: ${model}`;
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
