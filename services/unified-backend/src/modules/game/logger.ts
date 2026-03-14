import { createModuleLogger } from '@shared/utils/logger';

export const logger = createModuleLogger('game');

export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};
