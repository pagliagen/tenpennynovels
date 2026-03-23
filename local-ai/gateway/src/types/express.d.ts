import type { ClientConfig } from '../clients';

declare global {
  namespace Express {
    interface Request {
      /** Impostato da `authenticateClient` dopo X-API-Key valido. */
      client?: ClientConfig;
    }
  }
}

export {};
