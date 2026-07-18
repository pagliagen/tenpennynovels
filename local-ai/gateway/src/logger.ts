import winston from 'winston';

// Gateway è self-contained (Dockerfile non copia local-ai/shared/), quindi ha
// il proprio logger invece di dipendere da ../../shared/logger.ts.
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [Gateway] ${level}: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
