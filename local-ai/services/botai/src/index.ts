import mongoose from 'mongoose';
import { createApp } from './app';
import { createLogger } from '../../../shared/logger';
import { warmupModel, getModel } from '../../../shared/ollama';
import { resolveProvider } from './agent/AgentFactory';

const logger = createLogger('BotAI');
const PORT = parseInt(process.env.BOTAI_PORT as string, 10);
const MONGODB_URI = process.env.MONGODB_URI as string;

async function start() {
  await mongoose.connect(MONGODB_URI);
  logger.info(`MongoDB connected: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);

  const app = createApp();

  app.listen(PORT, () => {
    logger.info(`BotAI service listening on port ${PORT}`);

    const provider = resolveProvider();
    if (provider === 'inception') {
      logger.info(`Using Inception API — model: ${process.env.INCEPTION_MODEL || 'mercury-2'} (no warmup needed)`);
    } else if (provider === 'anthropic') {
      logger.info(`Using Anthropic API — model: ${process.env.ANTHROPIC_MODEL || 'claude'} (no warmup needed)`);
    } else {
      warmupModel()
        .then(() => logger.info(`Model ${getModel()} warmed up and locked in memory`))
        .catch((err) => logger.warn(`Warmup failed (will load on first request): ${err.message}`));
    }
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
