import winston from 'winston';
import path from 'path';
import { appConfig } from '@config/runtime/appConfig';

const LOG_LEVEL = appConfig.logLevel;

// Base logger configuration
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, module, ...metadata }) => {
    const moduleTag = module ? `[${module}]` : '';

    // Include metadata fields (error, stack, etc.) if present
    const metaStr = Object.keys(metadata).length > 0
      ? ' ' + JSON.stringify(metadata, null, 2)
      : ''; 

    return `${timestamp} ${moduleTag} ${level}: ${message}${metaStr}`;
  })
);

// File format without colors
const fileFormat = winston.format.combine(
  baseFormat,
  winston.format.printf(({ timestamp, level, message, module, ...metadata }) => {
    const moduleTag = module ? `[${module}]` : '';
 
    // Include metadata fields (error, stack, etc.) if present
    const metaStr = Object.keys(metadata).length > 0
      ? ' ' + JSON.stringify(metadata, null, 2) 
      : ''; 

    return `${timestamp} ${moduleTag} ${level}: ${message}${metaStr}`;
  })
);

/**
 * Create a logger for a specific module
 * @param moduleName - Name of the module (auth, game, documents, etc.)
 */
export function createModuleLogger(moduleName: string) {
  return winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: { module: moduleName },
    format: baseFormat,
    transports: [
      // Console output
      new winston.transports.Console({
        format: consoleFormat
      }),
      // Combined log file
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'combined.log'),
        format: fileFormat
      }),
      // Error log file
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        format: fileFormat
      }),
      // Module-specific log file
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', `${moduleName}.log`),
        format: fileFormat
      })
    ]
  });
}

// Create default logger for shared code
export const logger = createModuleLogger('core');

// Alias for backwards compatibility
export const createLogger = (options: { serviceName: string }) => {
  return createModuleLogger(options.serviceName);
};

// Export for HTTP request logging (Morgan)
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};
