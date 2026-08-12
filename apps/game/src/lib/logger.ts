type LogMeta = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';
 
export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (!isProduction) console.debug(message, meta);
  },
  info(message: string, meta?: LogMeta): void {
    if (!isProduction) console.info(message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    console.error(message, meta);
  },
};
