/**
 * Authentication Backend Logger  
 * TODO: Migrate to shared logger factory when workspace imports are configured
 * Currently using local implementation for compatibility
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level}]: ${message}`;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Generate date-based log filenames
const today = new Date();
const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
const logDir = '../../logs'; // Relative to services/authentication-backend/src/utils/

export const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'authentication-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test'
    }),
    
    // File transports (always enabled)
    new winston.transports.File({ 
      filename: `${logDir}/auth-${dateStr}.error.log`,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: productionFormat // Always use JSON for file logs
    }),
    new winston.transports.File({ 
      filename: `${logDir}/auth-${dateStr}.combined.log`,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: productionFormat // Always use JSON for file logs
    })
  ],
});

// Create a stream object for Morgan HTTP logging
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper functions for structured logging
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