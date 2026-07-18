type LogMeta = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';

function format(message: string, meta?: LogMeta): unknown[] {
  return meta ? [message, meta] : [message];
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (!isProduction) console.debug(...format(message, meta));
  },
  info(message: string, meta?: LogMeta): void {
    if (!isProduction) console.info(...format(message, meta));
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(...format(message, meta));
  },
  error(message: string, meta?: LogMeta): void {
    console.error(...format(message, meta));
  },
};
