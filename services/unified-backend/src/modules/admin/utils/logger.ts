/**
 * Management Backend Logger
 */

import winston from 'winston';
import { appConfig } from '@config/runtime';

const logLevel = appConfig.logLevel;
const isDevelopment = !appConfig.isProduction;

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
const logDir = '../../logs'; // Relative to services/management-backend/src/utils/

export const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'management-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: appConfig.isTest
    }),
    
    // File transports (always enabled)
    new winston.transports.File({ 
      filename: `${logDir}/management-${dateStr}.error.log`,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: productionFormat // Always use JSON for file logs
    }),
    new winston.transports.File({ 
      filename: `${logDir}/management-${dateStr}.combined.log`,
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