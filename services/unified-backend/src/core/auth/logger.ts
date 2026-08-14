import { createModuleLogger } from '@shared/utils/logger';

export const logger = createModuleLogger('auth');

export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export const logError = (error: Error, context: any = {}) => {
  logger.error('Error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

export const logSecurity = (event: string, details: any = {}) => {
  logger.warn('Security event', {
    event,
    ...details,
    component: 'security'
  });
};

export const logAuth = (event: string, userId?: string, details: any = {}) => {
  logger.info('Authentication event', {
    event,
    userId,
    ...details,
    component: 'auth'
  });
};

export const logRate = (action: string, identifier: string, details: any = {}) => {
  logger.warn('Rate limit event', {
    action,
    identifier,
    ...details,
    component: 'rate-limit'
  });
};
