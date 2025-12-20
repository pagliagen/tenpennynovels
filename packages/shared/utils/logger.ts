/**
 * Unified Logger Factory
 * Consolidates winston logger configuration from all services
 */

import winston from 'winston';
import path from 'path';

export interface LoggerConfig {
  serviceName: string;
  logLevel?: string;
  logDir?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
}

/**
 * Creates a standardized Winston logger for any service
 */
export const createLogger = (config: LoggerConfig) => {
  const {
    serviceName,
    logLevel = process.env.LOG_LEVEL || 'info',
    logDir = path.join(process.cwd(), '..', '..', 'logs'),
    enableConsole = true,
    enableFile = true
  } = config;

  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Generate date string for filename (YYYYMMDD format)
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Custom format for development
  const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      if (stack) {
        log += `\n${stack}`;
      }
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta, null, 2)}`;
      }
      return log;
    })
  );

  // Custom format for production
  const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const transports: winston.transport[] = [];

  // Console transport
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: isDevelopment ? developmentFormat : productionFormat,
        silent: process.env.NODE_ENV === 'test'
      })
    );
  }

  // File transports
  if (enableFile) {
    // Error logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-${dateStr}.error.log`),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: productionFormat // Always use JSON for file logs
      })
    );

    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-${dateStr}.combined.log`),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: productionFormat // Always use JSON for file logs
      })
    );
  }

  // Create logger instance
  const logger = winston.createLogger({
    level: logLevel,
    format: isDevelopment ? developmentFormat : productionFormat,
    defaultMeta: isDevelopment ? {} : { service: serviceName },
    transports
  });

  return logger;
};

/**
 * Creates HTTP logger stream for Morgan
 */
export const createHttpLoggerStream = (logger: winston.Logger) => ({
  write: (message: string) => {
    logger.info(message.trim());
  }
});

/**
 * Pre-configured loggers for common use cases
 */
export const createAuthLogger = () => createLogger({ serviceName: 'authentication-backend' });
export const createGameLogger = () => createLogger({ serviceName: 'game-backend' });
export const createManagementLogger = () => createLogger({ serviceName: 'management-backend' });
export const createGatewayLogger = () => createLogger({ serviceName: 'api-gateway' });

/**
 * Security logging helpers
 */
export const logError = (logger: winston.Logger, error: Error, context: any = {}) => {
  logger.error('Error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

export const logSecurity = (logger: winston.Logger, event: string, details: any = {}) => {
  logger.warn('Security event', {
    event,
    ...details,
    component: 'security'
  });
};

export const logAuth = (logger: winston.Logger, event: string, userId?: string, details: any = {}) => {
  logger.info('Authentication event', {
    event,
    userId,
    ...details,
    component: 'auth'
  });
};

export const logRate = (logger: winston.Logger, action: string, identifier: string, details: any = {}) => {
  logger.warn('Rate limit event', {
    action,
    identifier,
    ...details,
    component: 'rate-limit'
  });
};