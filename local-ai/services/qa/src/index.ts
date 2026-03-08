import { createApp } from './app';
import { createLogger } from '../../../shared/logger';
import { warmupModel, getModel } from '../../../shared/ollama';

const logger = createLogger('QA');
const PORT = parseInt(process.env.QA_PORT || '8090', 10);

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Q&A service listening on port ${PORT}`);

  warmupModel()
    .then(() => logger.info(`Model ${getModel()} warmed up and locked in memory`))
    .catch((err) => logger.warn(`Warmup failed (will load on first request): ${err.message}`));
});
