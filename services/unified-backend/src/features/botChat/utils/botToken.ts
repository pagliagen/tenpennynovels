import crypto from 'crypto';

/**
 * Il token con cui il servizio AI risponde al gioco. Lo conia il backend per OGNI evento e lo firma con
 * `BOT_SERVICE_SECRET` (HMAC-SHA256): il servizio AI non possiede mai il segreto, solo un token che permette di far
 * parlare **quel bot in quella location** per pochi minuti, in **quell'ambiente**.
 *
 * Formato: `v1.<payload base64url>.<firma base64url>`. Se cambia l'algoritmo cambia la versione.
 * `bot-service/src/character-bot/scripts/publishTestEvent.ts` ne ha una copia (solo per lo sviluppo): un test con un
 * vettore fisso in entrambi i pacchetti ne garantisce la compatibilità.
 */

export interface BotTokenPayload {
  /** Ambiente del backend che lo ha emesso (`local`, `production`...). */
  env: string;
  /** Location in cui il bot può scrivere. */
  loc: string;
  /** `characterId` del bot. */
  bot: string;
  /** Scadenza, secondi da epoch. */
  exp: number;
}

/** Quanto vale un token: una risposta richiede 1-2 minuti, il margine copre una generazione lenta. */
export const BOT_TOKEN_TTL_SECONDS = 15 * 60;

const b64 = (buffer: Buffer): string => buffer.toString('base64url');
const sign = (secret: string, body: string): Buffer => crypto.createHmac('sha256', secret).update(body).digest();

export function signBotToken(payload: BotTokenPayload, secret: string): string {
  const body = `v1.${b64(Buffer.from(JSON.stringify(payload)))}`;
  return `${body}.${b64(sign(secret, body))}`;
}

/** `null` per qualunque difetto: formato, firma, scadenza o forma del contenuto. Non lancia mai. */
export function verifyBotToken(token: string, secret: string, nowSeconds: number = Math.floor(Date.now() / 1000)): BotTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [version, payloadPart, signaturePart] = parts as [string, string, string];

  const expected = sign(secret, `${version}.${payloadPart}`);
  let provided: Buffer;
  try {
    provided = Buffer.from(signaturePart, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Partial<BotTokenPayload>;
    if (typeof payload.env !== 'string' || typeof payload.loc !== 'string' || typeof payload.bot !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= nowSeconds) return null;
    return { env: payload.env, loc: payload.loc, bot: payload.bot, exp: payload.exp };
  } catch {
    return null;
  }
}
