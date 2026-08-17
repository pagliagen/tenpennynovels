type LogMeta = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';

// '%s' come primo argomento (letterale, mai controllato dal chiamante) forza
// console.* a trattare `message` come valore da sostituire, non come stringa
// di formato - altrimenti un `message` con specificatori printf (%s, %d, %c...)
// costruito da input utente verrebbe interpretato invece che stampato as-is
// (CodeQL js/tainted-format-string).
export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (!isProduction) console.debug('%s', message, meta);
  },
  info(message: string, meta?: LogMeta): void {
    if (!isProduction) console.info('%s', message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn('%s', message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    console.error('%s', message, meta);
  },
};
