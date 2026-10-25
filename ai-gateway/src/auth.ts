import { createHash, timingSafeEqual } from 'node:crypto';

export const SECRET_HEADER = 'x-ai-gateway-secret';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Confronto a tempo costante. Si confrontano gli hash (stessa lunghezza sempre): così non trapela
 * nemmeno la lunghezza del segreto.
 */
export function isAuthorized(provided: string | string[] | undefined, secret: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  return timingSafeEqual(digest(provided), digest(secret));
}
