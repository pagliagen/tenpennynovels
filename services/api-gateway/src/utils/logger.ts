import winston from 'winston';
import path from 'path';
import { config } from '../config';

const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const logDir = path.join(process.cwd(), '..', '..', 'logs');

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
  }),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const jsonFileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isProduction ? productionFormat : developmentFormat,
  defaultMeta: config.isProduction ? { service: 'api-gateway' } : {},
  transports: [
    new winston.transports.Console({
      format: config.isProduction ? productionFormat : developmentFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, `gateway-${dateStr}.error.log`),
      level: 'error',
      format: jsonFileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, `gateway-${dateStr}.combined.log`),
      format: jsonFileFormat,
    }),
  ],
});

export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
