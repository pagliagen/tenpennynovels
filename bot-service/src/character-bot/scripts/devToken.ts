import crypto from 'crypto';

/**
 * Copia SOLO PER LO SVILUPPO dell'algoritmo con cui il gioco firma i token (`unified-backend/src/features/botChat/utils/botToken.ts`):
 * serve a `simulate` per provare il servizio senza passare dal gioco. Il servizio vero non firma né verifica nulla (riceve
 * il token e lo ripresenta). Un test con un vettore fisso, uguale a quello del backend, ne garantisce la compatibilità.
 */
export interface DevTokenPayload {
  env: string;
  loc: string;
  bot: string;
  exp: number;
}

export function signDevToken(payload: DevTokenPayload, secret: string): string {
  const body = `v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}
