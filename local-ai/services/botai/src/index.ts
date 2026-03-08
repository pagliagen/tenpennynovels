import mongoose from 'mongoose';
import { createApp } from './app';
import { createLogger } from '../../../shared/logger';
import { warmupModel, getModel } from '../../../shared/ollama';

const logger = createLogger('BotAI');
const PORT = parseInt(process.env.BOTAI_PORT || '8080', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27030/local-ai';

async function start() {
  await mongoose.connect(MONGODB_URI);
  logger.info(`MongoDB connected: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);

  const app = createApp();

  app.listen(PORT, () => {
    logger.info(`BotAI service listening on port ${PORT}`);

    warmupModel()
      .then(() => logger.info(`Model ${getModel()} warmed up and locked in memory`))
      .catch((err) => logger.warn(`Warmup failed (will load on first request): ${err.message}`));
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
