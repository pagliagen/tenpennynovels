/**
 * API Gateway Logger
 * TODO: Migrate to shared logger factory when workspace imports are configured
 * Currently using local implementation for compatibility
 */

import winston from 'winston';
import path from 'path';

// Generate date string for filename (YYYYMMDD format)
const today = new Date();
const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

// Log directory - using centralized logs folder
const logDir = path.join(process.cwd(), '..', '..', 'logs');

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
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

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: process.env.NODE_ENV === 'production' ? { service: 'api-gateway' } : {},
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, `gateway-${dateStr}.error.log`),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, `gateway-${dateStr}.combined.log`),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: developmentFormat
  }));
} else {
  logger.add(new winston.transports.Console({
    format: productionFormat
  }));
}

// Stream for Morgan HTTP logging
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Export default for backward compatibility
export default logger;