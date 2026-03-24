import { createApp } from './app';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGen');
const PORT = parseInt(process.env.CHAR_GEN_PORT as string, 10) || 8130;

async function start() {
  const app = createApp();

  app.listen(PORT, () => {
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku';
    logger.info(`CharacterGen service listening on port ${PORT}`);
    logger.info(`Using Anthropic API — model: ${model}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
